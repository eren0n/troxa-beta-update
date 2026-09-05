import resend
from django.conf import settings


def send_invite_email(invite):
    api_key = getattr(settings, 'RESEND_API_KEY', '')
    if not api_key:
        return

    resend.api_key = api_key

    invite_url = f"https://troxa.ai/invite/{invite.token}"
    workspace_name = invite.workspace.name

    if invite.invited_by:
        inviter = invite.invited_by.get_full_name().strip() or invite.invited_by.email
    else:
        inviter = "Your team"

    resend.Emails.send({
        "from": "Troxa.ai <noreply@troxa.ai>",
        "to": [invite.email],
        "subject": f"You've been invited to join {workspace_name} on Troxa.ai",
        "html": f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#05070d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#05070d;padding:48px 24px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#0c0f1a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:900;color:#3b82f6;text-transform:uppercase;letter-spacing:0.1em;">Workspace Invitation</p>
            <h1 style="margin:0 0 16px;font-size:26px;font-weight:900;color:#fff;line-height:1.2;">You're invited to join<br><span style="color:#3b82f6;">{workspace_name}</span></h1>
            <p style="margin:0 0 32px;font-size:14px;color:#94a3b8;line-height:1.6;">
              <strong style="color:#e2e8f0;">{inviter}</strong> has invited you to collaborate on <strong style="color:#e2e8f0;">{workspace_name}</strong> — an AI-powered creative platform for iGaming operators.
            </p>
            <a href="{invite_url}" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.01em;">
              Accept Invitation →
            </a>
            <p style="margin:32px 0 0;font-size:12px;color:#475569;line-height:1.6;">
              Or copy this link into your browser:<br>
              <span style="color:#3b82f6;">{invite_url}</span>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:11px;color:#334155;">
              If you didn't expect this invitation, you can safely ignore this email.
              This invite was sent to {invite.email}.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
        """,
    })
