# ─────────────────────────────────────────────────────────────────────────────
# Meta action_type → normalized field mapping
# Edit these lists to match your Meta account's custom event names.
# Multiple values per key are summed when present.
# ─────────────────────────────────────────────────────────────────────────────

ACTION_MAP = {
    # Registrations — only pixel event; plain 'complete_registration' is the
    # same event under a different name and would double-count web campaigns.
    'regs': [
        'offsite_conversion.fb_pixel_complete_registration',
    ],
    # FTP = initiate_checkout — only pixel event; plain 'initiate_checkout' is
    # the same event under a different name and would double-count web campaigns.
    'ftp': [
        'offsite_conversion.fb_pixel_initiate_checkout',
    ],
    # Purchases
    'purchases': [
        'offsite_conversion.fb_pixel_purchase',
        'purchase',
        'omni_purchase',
    ],
}

# Revenue is pulled from action_values using these same keys as purchases
REVENUE_ACTION_TYPES = ACTION_MAP['purchases']
