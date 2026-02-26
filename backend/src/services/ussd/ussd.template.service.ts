import { serverConfig } from "../../config/server.config.js";
import { Language } from "../../prisma/prisma/generated/enums.js";

/**
 * USSD Template Service
 * Centralizes all USSD message templates with i18n support
 */
export class USSDTemplateService {
  private static readonly APP_NAME = serverConfig.app.name.split("_")[0];
  private static readonly APP_NAME_LOWER = this.APP_NAME?.toLowerCase();

  // ==================== WELCOME & START ====================

  static welcomeRegistered(firstName: string, state: string, lga: string): string {
    return `CON Welcome back, ${firstName}! You are registered for alerts in ${state}, ${lga}.

            1. Update Information
            2. Unsubscribe from Alerts
            3. Help
            0. Exit`;
  }

  static welcomeUnsubscribed(firstName: string): string {
    return `CON Welcome back, ${firstName}!
            You are currently unsubscribed from alerts.

            1. Re-subscribe to Alerts
            2. Update Information
            3. Help
            0. Exit`;
  }

  static welcomeNew(): string {
    return `CON Welcome to ${this.APP_NAME}! Register to receive emergency alerts.

            Select your preferred language:
            1. English
            2. Hausa
            3. Yoruba
            4. Igbo
            5. Pidgin`;
  }

  // ==================== REGISTRATION PROMPTS ====================

  static promptFirstName(): string {
    return "CON Enter your first name:";
  }

  static promptLastName(): string {
    return "CON Enter your last name:";
  }

  static invalidName(): string {
    return "CON Name too short. Enter your first name:";
  }

  static invalidLastName(): string {
    return "CON Name too short. Enter your last name:";
  }

  static invalidLanguage(): string {
    return `CON Invalid option. Select language:
            1. English
            2. Hausa
            3. Yoruba
            4. Igbo
            5. Pidgin`;
  }

  // ==================== PAGINATION ====================

  static statesPage(states: Array<{ id: string; name: string }>, page: number, totalPages: number, hasPrev: boolean, hasNext: boolean): string {
    let response = `CON Select your state (Page ${page + 1}/${totalPages}):\n`;

    states.forEach((state, index) => {
      response += `${index + 1}. ${state.name}\n`;
    });

    if (hasPrev) {
      response += `9. Previous Page\n`;
    }
    if (hasNext) {
      response += `${hasPrev ? "0" : "9"}. Next Page`;
    }

    return response;
  }

  static lgasPage(lgas: Array<{ id: string; name: string }>, stateName: string, page: number, totalPages: number, hasPrev: boolean, hasNext: boolean): string {
    let response = `CON Select your LGA in ${stateName} (Page ${page + 1}/${totalPages}):\n`;

    lgas.forEach((lga, index) => {
      response += `${index + 1}. ${lga.name}\n`;
    });

    if (hasPrev) {
      response += `9. Previous Page\n`;
    }
    if (hasNext) {
      response += `${hasPrev ? "0" : "9"}. Next Page`;
    }

    return response;
  }

  static wardsPage(wards: Array<{ id: string; name: string }>, lgaName: string, page: number, totalPages: number, hasPrev: boolean, hasNext: boolean): string {
    let response = `CON Select your Ward in ${lgaName} (Page ${page + 1}/${totalPages}):\n`;

    wards.forEach((ward, index) => {
      response += `${index + 1}. ${ward.name}\n`;
    });

    response += `8. Skip (No ward)\n`;

    if (hasPrev) {
      response += `9. Previous Page\n`;
    }
    if (hasNext) {
      response += `0. Next Page`;
    }

    return response;
  }

  // ==================== CONFIRMATION ====================

  static confirmationUpdate(data: { firstName: string; lastName: string; stateName: string; lgaName: string; wardName?: string; language?: Language }): string {
    return `CON Confirm your update:
            Name: ${data.firstName} ${data.lastName}
            State: ${data.stateName}
            LGA: ${data.lgaName}
            ${data.wardName ? `Ward: ${data.wardName}\n` : ""}${data.language ? `Language: ${data.language}\n` : ""}
            1. Confirm and Update
            2. Cancel`;
  }

  static confirmationRegistration(data: { firstName: string; lastName: string; stateName: string; lgaName: string; wardName?: string; language?: Language }): string {
    return `CON Confirm your registration:
            Name: ${data.firstName} ${data.lastName}
            State: ${data.stateName}
            LGA: ${data.lgaName}
            ${data.wardName ? `Ward: ${data.wardName}\n` : ""}${data.language ? `Language: ${data.language}\n` : ""}
            1. Confirm and Register
            2. Cancel`;
  }

  static invalidConfirmation(isUpdate: boolean): string {
    return `CON Invalid option.
            1. Confirm and ${isUpdate ? "Update" : "Register"}
            2. Cancel`;
  }

  // ==================== UNSUBSCRIBE ====================

  static unsubscribeConfirm(): string {
    return `CON Are you sure you want to unsubscribe?
            1. Yes, unsubscribe
            2. No, keep receiving alerts`;
  }

  static invalidUnsubscribe(): string {
    return `CON Invalid option.
            1. Yes, unsubscribe
            2. No, keep alerts`;
  }

  // ==================== SUCCESS MESSAGES ====================

  static registrationSuccess(firstName: string): string {
    return `END Registration successful!
            Welcome to ${this.APP_NAME}, ${firstName}!
            You will receive emergency alerts via SMS.`;
  }

  static updateSuccess(): string {
    return `END Information updated successfully!
            Your details have been updated.
            You will continue to receive alerts.`;
  }

  static resubscribeSuccess(): string {
    return `END You have been re-subscribed to ${this.APP_NAME}!
            You will now receive emergency alerts.`;
  }

  static unsubscribeSuccess(): string {
    return `END You have been unsubscribed.
            To re-subscribe, dial the USSD code again.`;
  }

  static unsubscribeCancelled(): string {
    return `END You will continue receiving alerts.
            Stay safe!`;
  }

  static registrationCancelled(): string {
    return "END Registration cancelled.";
  }

  static exitMessage(): string {
    return `END Thank you for using ${this.APP_NAME}.`;
  }

  // ==================== ERROR MESSAGES ====================

  static genericError(): string {
    return "END An error occurred. Please try again later.";
  }

  static serviceUnavailable(): string {
    return "END Service temporarily unavailable. Please try again.";
  }

  static accountNotFound(): string {
    return "END Account not found. Please register again.";
  }

  static operationFailed(): string {
    return "END Operation failed due to a system error. Please try again later.";
  }

  static unsubscribeFailed(): string {
    return "END Unsubscribe failed. Please try again.";
  }

  static invalidSelection(): string {
    return "CON Invalid selection. Please enter 1-8 for items, or use navigation.";
  }

  static invalidStateSelection(): string {
    return "CON Invalid state selection. Please try again.";
  }

  static invalidLGASelection(): string {
    return "CON Invalid LGA selection. Please try again.";
  }

  static invalidWardSelection(): string {
    return "CON Invalid ward selection. Please try again or select 8 to skip.";
  }

  static invalidWardNavigation(): string {
    return "CON Invalid selection. Enter 1-7, 8 to Skip, or use 9/0 for navigation.";
  }

  // ==================== HELP ====================

  static help(): string {
    return `END ${this.APP_NAME} Help:
          - Receive emergency alerts via SMS
          - Update your info anytime
          - Unsubscribe anytime
          - Free service

          Contact: support@${this.APP_NAME_LOWER}.gov.ng`;
  }

  // ==================== INVALID MENU OPTIONS ====================

  static invalidMainMenuRegistered(): string {
    return `CON Invalid option. Please try again.
            1. Update Information
            2. Unsubscribe from Alerts
            3. Help
            0. Exit`;
  }

  static invalidMainMenuUnsubscribed(): string {
    return `CON Invalid option. Please try again.
            1. Re-subscribe to Alerts
            2. Update Information
            3. Help
            0. Exit`;
  }

  // ==================== LANGUAGE MAPPING ====================

  static getLanguageMap(): Record<string, Language> {
    return {
      "1": Language.ENGLISH,
      "2": Language.HAUSA,
      "3": Language.YORUBA,
      "4": Language.IGBO,
      "5": Language.PIDGIN,
    };
  }

  // ==================== LOCALIZATION (FUTURE) ====================

  /**
   * Get localized message based on language preference
   * Currently returns English, but can be extended for i18n
   */
  static localize(key: string, language: Language = Language.ENGLISH): string {
    // Future: Implement full i18n support
    // For now, return English versions
    const messages: Record<string, string> = {
      "welcome.new": this.welcomeNew(),
      "prompt.first_name": this.promptFirstName(),
      "prompt.last_name": this.promptLastName(),
      "error.generic": this.genericError(),
      help: this.help(),
    };

    return messages[key] || "";
  }

  // ==================== DYNAMIC CONTENT HELPERS ====================

  /**
   * Format location string
   */
  static formatLocation(state: string, lga: string, ward?: string): string {
    return ward ? `${state}, ${lga}, ${ward}` : `${state}, ${lga}`;
  }

  /**
   * Format full name
   */
  static formatName(firstName: string, lastName: string): string {
    return `${firstName} ${lastName}`;
  }
}
