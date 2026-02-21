import { serverConfig } from "../../config/server.config.js";
import {
  EmailType,
  type IAgencyActivationData,
  type IAgencyWelcomeData,
  type IPasswordResetData,
  type ITwoFactorData,
  type IUserActivationData,
  type IUserWelcomeData,
} from "../../types/email.types.js";

export class EmailTemplateService {
  static readonly APP_NAME = serverConfig.app.name.split("_")[0];
  private static readonly PRIMARY_COLOR = "#007bff";
  private static readonly WARNING_COLOR = "#ffc107";

  /**
   * The Master Layout
   * Wraps content in a standard header/footer/style shell
   */
  private static getMasterLayout(title: string, content: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9f9f9; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
            .header { background: ${this.PRIMARY_COLOR}; color: white; padding: 30px 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; letter-spacing: 1px; }
            .content { padding: 40px 30px; }
            .footer { background: #f1f1f1; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #eee; }
            .btn { display: inline-block; padding: 12px 24px; background: ${this.PRIMARY_COLOR}; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; }
            .code-box { background: #f4f4f4; border: 2px solid ${this.PRIMARY_COLOR}; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; font-family: monospace; }
            .code { font-size: 32px; font-weight: bold; color: ${this.PRIMARY_COLOR}; letter-spacing: 4px; }
            .warning-box { background: #fff3cd; border-left: 5px solid ${this.WARNING_COLOR}; padding: 15px; margin: 20px 0; font-size: 14px; }
            .info-list { list-style: none; padding: 0; margin: 20px 0; }
            .info-list li { padding: 10px 0; border-bottom: 1px solid #eee; }
            .info-list li strong { min-width: 120px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${this.APP_NAME} System</h1>
            </div>
            <div class="content">
              ${content}
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} National Emergency Management Agency (NEMA).</p>
              <p>This is an automated security notification. Please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Public Generator Method
   */
  static generateHtml(
    type: EmailType,
    data: any
  ): { subject: string; html: string } {
    // Inject App Name into data if missing
    const templateData = { ...data, appName: this.APP_NAME };

    switch (type) {
      case EmailType.TWO_FACTOR_SETUP:
        return {
          subject: `${this.APP_NAME} - 2FA Verification Code`,
          html: this.getMasterLayout(
            "Verify Email",
            this.render2FASetup(templateData)
          ),
        };

      case EmailType.TWO_FACTOR_LOGIN:
        return {
          subject: `${this.APP_NAME} - Login Code`,
          html: this.getMasterLayout(
            "Login Verification",
            this.render2FALogin(templateData)
          ),
        };

        //PROTECTED ACTIONS
      case EmailType.TWO_FACTOR_ACTION:
        return {
          subject: `${this.APP_NAME} - Security Verification Code`,
          html: this.getMasterLayout("Security Check", this.render2FAAction(templateData)),
        };

      case EmailType.USER_WELCOME:
        return {
          subject: `Welcome to ${this.APP_NAME}`,
          html: this.getMasterLayout(
            "Welcome Aboard",
            this.renderUserWelcome(templateData)
          ),
        };

      case EmailType.AGENCY_WELCOME:
        return {
          subject: `Agency Registration Successful - ${this.APP_NAME}`,
          html: this.getMasterLayout(
            "Agency Registered",
            this.renderAgencyWelcome(templateData)
          ),
        };

      case EmailType.PASSWORD_RESET:
        return {
          subject: `${this.APP_NAME} - Password Reset Request`,
          html: this.getMasterLayout(
            "Reset Password",
            this.renderPasswordReset(templateData)
          ),
        };

      case EmailType.USER_ACTIVATION:
        return {
          subject: `${this.APP_NAME} - Account Activation`,
          html: this.getMasterLayout(
            "Account Activation",
            this.renderUserActivation(templateData)
          ),
        };

      case EmailType.AGENCY_ACTIVATION:
        return {
          subject: `${this.APP_NAME} - Agency Activation`,
          html: this.getMasterLayout(
            "Agency Activation",
            this.renderAgencyActivation(templateData)
          ),
        };

      default:
        throw new Error(`Template for email type ${type} not found`);
    }
  }

  // --- Partial Renderers ---

  private static render2FASetup(data: ITwoFactorData): string {
    return `
      <h2>Verify Your Email</h2>
      <p>You are setting up Two-Factor Authentication for your account.</p>
      <p>Please enter the code below to verify your email address:</p>

      <div class="code-box">
        <div class="code">${data.code}</div>
      </div>

      <p>This code will expire in <strong>${data.expiryMinutes } ${data.expiryMinutes! > 1 ? "minutes" : "minute"}</strong>.</p>

      <div class="warning-box">
        <strong>Security Notice:</strong> Never share this code with anyone. Our support team will never ask for it.
      </div>
    `;
  }

  private static render2FALogin(data: ITwoFactorData): string {
    return `
      <h2>Login Verification</h2>
      <p>A login attempt was made for your account.</p>

      <div class="code-box">
        <div class="code">${data.code}</div>
      </div>

      <p>This code will expire in <strong>${data.expiryMinutes } ${data.expiryMinutes! > 1 ? "minutes" : "minute"}</strong>.</p>

      <p>If you did not request this code, please secure your account immediately.</p>
    `;
  }

  private static render2FAAction(data: ITwoFactorData): string {
    return `
      <h2>Security Verification</h2>
      <p>You are attempting to perform a sensitive action on your account.</p>
      <p>Please enter the code below to proceed:</p>

      <div class="code-box">
        <div class="code">${data.code}</div>
      </div>

      <p>This code will expire in <strong>${data.expiryMinutes} ${data.expiryMinutes! > 1 ? "minutes" : "minute"}</strong>.</p>

      <div class="warning-box">
        <strong>Did not request this?</strong> If you are not performing this action, please change your password immediately and contact support.
      </div>
    `;
  }

  private static renderUserWelcome(data: IUserWelcomeData): string {
    const permissionsHtml = this.getRolePermissions(data.role);

    return `
      <h2>Welcome, ${data.firstName}!</h2>
      <p>You have been added to the <strong>${data.agencyName}</strong> team on the ${data.appName} platform${data.creatorName ? ` by ${data.creatorName}` : ""}.</p>

      <h3>Your Access Details</h3>
      <ul class="info-list">
        <li><strong>Role:</strong> ${data.role}</li>
        <li><strong>Username:</strong> ${data.email}</li>
        ${data.temporaryPassword ? `<li><strong>Temporary Password:</strong> ${data.temporaryPassword}</li>` : ""}
      </ul>

      <h3>Your Permissions</h3>
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef;">
        <ul style="list-style-type: none; padding-left: 0; margin: 0;">
          ${permissionsHtml}
        </ul>
      </div>

      <p style="text-align: center; margin-top: 30px;">
        <a href="${data.loginUrl}" class="btn">Access Dashboard</a>
      </p>

      <div class="warning-box">
        <strong>Important:</strong> You must change your password immediately upon your first login.
      </div>
    `;
  }

  private static renderAgencyWelcome(data: IAgencyWelcomeData): string {
    return `
      <h2>Agency Registration Confirmed</h2>
      <p>Dear ${data.adminName},</p>
      <p>Your agency <strong>${data.agencyName}</strong> has been successfully registered.</p>

      <h3>Agency Profile</h3>
      <ul class="info-list">
        <li><strong>Type:</strong> ${data.agencyType}</li>
        <li><strong>Jurisdiction:</strong> ${data.jurisdiction}</li>
        <li><strong>Jurisdiction Level:</strong> ${data.jurisdictionLevel}</li>
      </ul>

      <h3>Administrator Credentials</h3>
      <ul class="info-list">
        <li><strong>Email:</strong> ${data.email}</li>
        <li><strong>Temporary Password:</strong> ${data.temporaryPassword}</li>
      </ul>

      <p style="text-align: center;">
        <a href="${data.loginUrl}" class="btn">Login to Portal</a>
      </p>
    `;
  }

  private static renderPasswordReset(data: IPasswordResetData): string {
    return `
      <h2>Password Reset Request</h2>
      <p>Hello ${data.firstName},</p>
      <p>We received a request to reset the password for your account.</p>

      ${data.temporaryPassword ? `
        <div class="code-box">
          <p style="margin:0; font-size:14px; color:#666;">Temporary Password:</p>
          <div class="code" style="font-size: 24px;">${data.temporaryPassword}</div>
        </div>
      ` : ""}

      ${data.resetUrl ? `
        <p style="text-align: center;">
          <a href="${data.resetUrl}" class="btn">Reset Password</a>
        </p>
      ` : ""}

      <div class="warning-box">
        If you did not request this change, please contact your agency administrator immediately.
      </div>
    `;
  }

  private static getRolePermissions(role: string): string {
    const permissions: Record<string, string> = {
      ADMIN: `
        <li style="margin-bottom: 5px;">✅ Create and manage agency users</li>
        <li style="margin-bottom: 5px;">✅ Create, send, and cancel alerts</li>
        <li style="margin-bottom: 5px;">✅ View all agency alerts and reports</li>
        <li style="margin-bottom: 5px;">✅ Manage agency settings & audit logs</li>
      `,
      COORDINATOR: `
        <li style="margin-bottom: 5px;">✅ Create, send, and cancel alerts</li>
        <li style="margin-bottom: 5px;">✅ View all agency alerts and reports</li>
        <li style="margin-bottom: 5px;">✅ Coordinate emergency responses</li>
        <li style="margin-bottom: 5px; color: #dc3545;">❌ Cannot manage users or agency settings</li>
      `,
      OPERATOR: `
        <li style="margin-bottom: 5px;">✅ Create and send alerts</li>
        <li style="margin-bottom: 5px;">✅ View sent alerts & delivery status</li>
        <li style="margin-bottom: 5px; color: #dc3545;">❌ Cannot cancel alerts created by others</li>
        <li style="margin-bottom: 5px; color: #dc3545;">❌ Cannot manage users</li>
      `,
      VIEWER: `
        <li style="margin-bottom: 5px;">✅ View all agency alerts</li>
        <li style="margin-bottom: 5px;">✅ View reports and statistics</li>
        <li style="margin-bottom: 5px; color: #dc3545;">❌ Cannot create or send alerts</li>
        <li style="margin-bottom: 5px; color: #dc3545;">❌ Cannot manage users</li>
      `,
    };

    return permissions[role] || "<li>✅ Standard user access</li>";
  }

  private static renderUserActivation(data: IUserActivationData): string {
    return `
    <h2>Welcome, ${data.firstName}!</h2>
    <p>You have been added to <strong>${data.agencyName}</strong>${data.creatorName ? ` by ${data.creatorName}` : ""}.</p>

    <h3>Your Access Details</h3>
    <ul class="info-list">
      <li><strong>Role:</strong> ${data.role}</li>
      <li><strong>Email:</strong> ${data.email}</li>
    </ul>

    <p style="text-align: center; margin: 30px 0;">
      <a href="${data.activationUrl}" class="btn">Activate Account & Set Password</a>
    </p>

    <div class="warning-box">
      <strong>⚠️ Important:</strong>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>This link expires in ${data.expiresInHours} ${data.expiresInHours > 1 ? "hours" : "hour"}</li>
        <li>You'll set your own secure password</li>
        <li>Never share this link with anyone</li>
      </ul>
    </div>

    <p style="font-size: 12px; color: #666; margin-top: 20px;">
      If the button doesn't work, copy and paste this link:<br>
      <code style="word-break: break-all;">${data.activationUrl}</code>
    </p>
  `;
  }

  private static renderAgencyActivation(data: IAgencyActivationData): string {
    return `
    <h2>Agency Registration Confirmed</h2>
    <p>Dear ${data.adminName},</p>
    <p>Your agency <strong>${data.agencyName}</strong> has been successfully registered.</p>

    <h3>Agency Profile</h3>
    <ul class="info-list">
      <li><strong>Type:</strong> ${data.agencyType}</li>
      <li><strong>Jurisdiction:</strong> ${data.jurisdiction}</li>
    </ul>

    <p style="text-align: center; margin: 30px 0;">
      <a href="${data.activationUrl}" class="btn">Activate Account & Set Password</a>
    </p>

    <div class="warning-box">
      <strong>🔒 Secure Activation:</strong>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>Click the link to set your own password</li>
        <li>Link expires in ${data.expiresInHours} ${data.expiresInHours > 1 ? "hours" : "hour"}</li>
        <li>This is a one-time use link</li>
      </ul>
    </div>
  `;
  }
}