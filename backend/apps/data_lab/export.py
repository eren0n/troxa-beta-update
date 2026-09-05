"""
Dataset export module.

The INPUT/OUTPUT mapping lives here — change this file to adjust what goes
into the model prompt vs. the model response, or to support a new framework.

Supported formats:
  qwen          — Qwen2.5-VL SFT (LLaMA-Factory / ms-swift style)
  llama_factory — alias for qwen (same schema)
  raw_json      — one JSON object per line, all fields flat (for inspection)
"""
import json


SYSTEM_PROMPT = (
    "You are a Meta Ads performance simulator. "
    "Given an ad creative and campaign settings, predict the performance metrics "
    "and assess the creative. Respond only in JSON."
)


def _safe_div(a, b):
    if a is None or not b:
        return None
    return round(float(a) / float(b), 4)


def _user_text(rec):
    """Build the text portion of the user turn (INPUT to the model)."""
    parts = []
    if rec.objective:
        parts.append(f'Objective: {rec.objective}')
    if rec.daily_budget:
        parts.append(f'Daily budget: ${float(rec.daily_budget):.0f}')
    elif rec.lifetime_budget:
        parts.append(f'Lifetime budget: ${float(rec.lifetime_budget):.0f}')
    if rec.campaign_name:
        parts.append(f'Campaign: {rec.campaign_name}')
    if rec.adset_name:
        parts.append(f'Ad set: {rec.adset_name}')
    if rec.target_audience:
        parts.append(f'Target audience: {rec.target_audience}')
    return '\n'.join(parts) if parts else 'No campaign context available.'


def _assistant_json(rec):
    """Build the assistant response JSON (OUTPUT for the model to learn).
    Uses ratios/rates rather than absolute numbers — these are budget-independent
    and actually reflect creative quality.
    """
    obj = {
        'roas': _safe_div(rec.revenue, rec.spend),
        'ctr': _safe_div(rec.clicks, rec.impressions),
        'cost_per_reg': _safe_div(rec.spend, rec.regs),
        'cost_per_ftp': _safe_div(rec.spend, rec.ftp),
        'reg_to_ftp': _safe_div(rec.ftp, rec.regs),
        'personal_rating': rec.personal_rating,
        'success_rating': rec.success_rating,
        'assessment': rec.notes or '',
    }
    return json.dumps(obj, ensure_ascii=False)


def _qwen_record(rec):
    """Qwen2.5-VL SFT format for Transformers + TRL + PEFT.
    processor.apply_chat_template handles vision tokens automatically.
    Image path: URL for JSONL-only export, local filename for zip export.
    """
    image_ref = rec.creative_image_url or ''
    return {
        'messages': [
            {
                'role': 'system',
                'content': SYSTEM_PROMPT,
            },
            {
                'role': 'user',
                'content': [
                    {'type': 'image', 'image': image_ref},
                    {'type': 'text', 'text': _user_text(rec)},
                ],
            },
            {
                'role': 'assistant',
                'content': _assistant_json(rec),
            },
        ],
    }


def _raw_record(rec):
    """Flat JSON for inspection / custom processing."""
    return {
        'id': rec.id,
        'ad_id': rec.ad_id,
        'ad_name': rec.ad_name,
        'campaign_name': rec.campaign_name,
        'objective': rec.objective,
        'daily_budget': float(rec.daily_budget) if rec.daily_budget else None,
        'lifetime_budget': float(rec.lifetime_budget) if rec.lifetime_budget else None,
        'creative_image_path': rec.creative_image_path,
        'impressions': rec.impressions,
        'reach': rec.reach,
        'clicks': rec.clicks,
        'spend': float(rec.spend),
        'regs': float(rec.regs),
        'ftp': float(rec.ftp) if rec.ftp is not None else None,
        'purchases': float(rec.purchases),
        'revenue': float(rec.revenue),
        # Derived (for inspection only)
        'ctr': _safe_div(rec.clicks, rec.impressions),
        'roas': _safe_div(rec.revenue, rec.spend),
        'cost_per_reg': _safe_div(rec.spend, rec.regs),
        'cost_per_purchase': _safe_div(rec.spend, rec.purchases),
        # Annotations
        'target_audience': rec.target_audience,
        'notes': rec.notes,
        'personal_rating': rec.personal_rating,
        'success_rating': rec.success_rating,
        'labeled_by': rec.labeled_by.email if rec.labeled_by else None,
        'labeled_at': rec.labeled_at.isoformat() if rec.labeled_at else None,
    }


def build_jsonl(records, fmt='qwen', image_path_map=None):
    """Convert a list of AdRecord objects to a list of JSON strings (one per line).
    image_path_map: optional dict of {rec.id: 'filename.jpg'} for zip exports
                    (overrides the default CDN URL with a local filename).
    """
    lines = []
    for rec in records:
        if fmt in ('qwen', 'llama_factory'):
            obj = _qwen_record(rec)
            if image_path_map and rec.id in image_path_map:
                local = image_path_map[rec.id]
                for msg in obj['messages']:
                    if msg['role'] == 'user':
                        for part in msg.get('content', []):
                            if part.get('type') == 'image':
                                part['image'] = local
        else:
            obj = _raw_record(rec)
            if image_path_map and rec.id in image_path_map:
                obj['creative_image_path'] = image_path_map[rec.id]
        lines.append(json.dumps(obj, ensure_ascii=False))
    return lines
