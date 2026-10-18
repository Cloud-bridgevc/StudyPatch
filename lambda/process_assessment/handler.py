"""Assessment processing Lambda.

Triggered by SQS when a student completes an attempt. Computes per-skill evidence (same rules as
app/engine.js `summarise`) and upserts `skill_evidence`. No AI is involved, no names are read.

Event (one SQS record body, JSON):
  {"tenant_id": "...", "attempt_id": "...", "responses": [
      {"skill": "FOP", "d": 2, "correct": false, "mis": "FRAC_ACROSS"}, ...]}
"""
import json
import os

LABELS = (("Secure", 0.75), ("Developing", 0.4), ("Needs practice", 0.0))


def label(score: float, n: int) -> str:
    if n < 2:
        return "Not enough evidence"
    for name, floor in LABELS:
        if score >= floor:
            return name
    return "Needs practice"


def summarise(responses):
    out = {}
    for r in responses:
        s = out.setdefault(r["skill"], {"n": 0, "w": 0, "wc": 0, "mis": {}})
        s["n"] += 1
        s["w"] += r["d"]
        if r["correct"]:
            s["wc"] += r["d"]
        elif r.get("mis"):
            s["mis"][r["mis"]] = s["mis"].get(r["mis"], 0) + 1
    for s in out.values():
        s["score"] = round(s["wc"] / s["w"], 3) if s["w"] else 0.0
        s["label"] = label(s["score"], s["n"])
    return out


def _validate(body):
    if not isinstance(body.get("responses"), list) or not body["responses"]:
        raise ValueError("responses required")
    for r in body["responses"]:
        if not (isinstance(r.get("skill"), str) and isinstance(r.get("d"), int) and 1 <= r["d"] <= 5
                and isinstance(r.get("correct"), bool)):
            raise ValueError("malformed response")


def _connect():
    import boto3, psycopg2  # imported lazily so unit tests need neither
    secret = boto3.client("secretsmanager").get_secret_value(SecretId=os.environ["DB_SECRET_ARN"])
    cfg = json.loads(secret["SecretString"])
    return psycopg2.connect(host=os.environ["DB_PROXY_ENDPOINT"], dbname=cfg["dbname"], user=cfg["username"],
                            password=cfg["password"], sslmode="verify-full", sslrootcert="/opt/rds-ca.pem")


def handler(event, _ctx=None):
    failures = []
    conn = None
    for rec in event.get("Records", []):
        try:
            body = json.loads(rec["body"])
            _validate(body)
            evidence = summarise(body["responses"])
            conn = conn or _connect()
            with conn, conn.cursor() as cur:
                cur.execute("SELECT set_config('app.tenant_id', %s, true), set_config('app.role', 'service', true)", (body["tenant_id"],))
                for skill, e in evidence.items():
                    cur.execute(
                        """INSERT INTO skill_evidence (attempt_id, skill_id, tenant_id, n, weighted_score, label)
                           VALUES (%s,%s,%s,%s,%s,%s)
                           ON CONFLICT (attempt_id, skill_id) DO UPDATE
                           SET n = EXCLUDED.n, weighted_score = EXCLUDED.weighted_score, label = EXCLUDED.label""",
                        (body["attempt_id"], skill, body["tenant_id"], e["n"], e["score"], e["label"]))
            print(json.dumps({"event": "evidence_written", "attempt_id": body["attempt_id"], "skills": len(evidence)}))  # IDs only
        except Exception as exc:  # report partial batch failure so SQS retries only this message
            print(json.dumps({"event": "error", "type": type(exc).__name__}))
            failures.append({"itemIdentifier": rec.get("messageId")})
    return {"batchItemFailures": failures}
