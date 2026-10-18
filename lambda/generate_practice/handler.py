"""Practice-generation Lambda (Amazon Bedrock).

Privacy by design: the model only receives curriculum text (skill + misconception descriptions). It never
receives student names, IDs, responses or class information. Output is validated, stored as a DRAFT and
cannot reach students until a teacher approves it (enforced by a DB CHECK constraint on practice_set).

Environment: BEDROCK_MODEL_ID, GUARDRAIL_ID, GUARDRAIL_VERSION, DB_SECRET_ARN, DB_PROXY_ENDPOINT.
"""
import json
import os

PROMPT_VERSION = "2026-10-v1"

SYSTEM = (
    "You write short mathematics practice for school students aged 11-12 for a teacher to review. "
    "Be accurate, encouraging and plain. Never comment on a student's ability, intelligence or any "
    "learning difficulty. Output ONLY JSON matching the schema."
)

SCHEMA_HINT = {
    "worked_example": {"problem": "str", "steps": ["str"], "answer": "str"},
    "items": [{"stem": "str", "options": [{"text": "str", "misconception": "id|null"}],
               "correct_index": 0, "hints": ["str", "str", "str"], "explanation_steps": ["str"]}],
}


def build_prompt(req):
    return (
        f"Skill: {req['skill_name']}.\n"
        f"Reasoning pattern to address (hypothesis, not a diagnosis): {req['misconception_name']}: {req['misconception_description']}\n"
        f"Write one worked example and {req['count']} multiple-choice practice questions (4 options each, exactly one correct). "
        f"Make distractors reflect this pattern where natural and tag them with the misconception id '{req['misconception_id']}'. "
        f"Give 3 progressive hints per question. Use whole numbers or simple fractions.\nSchema: {json.dumps(SCHEMA_HINT)}"
    )


def validate(draft, count):
    """Structural checks that must pass before a draft is stored. Raises ValueError otherwise."""
    items = draft.get("items")
    if not isinstance(items, list) or len(items) != count:
        raise ValueError("wrong number of items")
    for it in items:
        opts = it.get("options", [])
        texts = [o.get("text", "") for o in opts]
        if len(opts) != 4 or len(set(texts)) != 4 or any(not t.strip() for t in texts):
            raise ValueError("options must be four distinct non-empty strings")
        ci = it.get("correct_index")
        if not isinstance(ci, int) or not 0 <= ci < 4:
            raise ValueError("correct_index invalid")
        if len(it.get("hints", [])) != 3 or not it.get("explanation_steps"):
            raise ValueError("hints/explanation missing")
        if any(o.get("misconception") for i, o in enumerate(opts) if i == ci):
            raise ValueError("correct option cannot carry a misconception tag")
    we = draft.get("worked_example", {})
    if not (we.get("problem") and we.get("steps") and we.get("answer")):
        raise ValueError("worked example incomplete")
    return True


def call_model(prompt):
    import boto3  # lazy import for unit tests
    br = boto3.client("bedrock-runtime")
    resp = br.converse(
        modelId=os.environ["BEDROCK_MODEL_ID"],
        system=[{"text": SYSTEM}],
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 2000, "temperature": 0.4},
        guardrailConfig={"guardrailIdentifier": os.environ["GUARDRAIL_ID"], "guardrailVersion": os.environ["GUARDRAIL_VERSION"]},
    )
    if resp.get("stopReason") == "guardrail_intervened":
        raise ValueError("guardrail intervened")
    return json.loads(resp["output"]["message"]["content"][0]["text"])


def handler(event, _ctx=None):
    req = event if isinstance(event, dict) and "skill_name" in event else json.loads(event["body"])
    for forbidden in ("student_id", "student_name", "responses", "class_id"):
        if forbidden in req:  # belt and braces: refuse any payload carrying student data
            return {"statusCode": 400, "body": json.dumps({"error": "student data must not be sent"})}
    count = max(1, min(int(req.get("count", 3)), 5))
    req["count"] = count
    try:
        draft = call_model(build_prompt(req))
        validate(draft, count)
    except Exception as exc:
        print(json.dumps({"event": "generation_rejected", "reason": type(exc).__name__}))
        return {"statusCode": 502, "body": json.dumps({"error": "generation failed validation; no draft created"})}
    result = {"status": "draft", "ai_generated": True, "prompt_version": PROMPT_VERSION,
              "model_id": os.environ.get("BEDROCK_MODEL_ID"), "content": draft,
              "validation": {"structure": True, "answers_verified_by_code": False}}
    # Persist as DRAFT through the API's DB layer (omitted here). A teacher must approve before assignment.
    return {"statusCode": 200, "body": json.dumps(result)}
