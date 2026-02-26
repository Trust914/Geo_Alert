import { USSD_ITEMS_PER_PAGE } from "../../config/africasTalking.config.js";
import { cacheConstants } from "../../config/cache.constants.js";
import { prisma } from "../../lib/prisma.js";
import { Language, USSDStep } from "../../prisma/prisma/generated/enums.js";
import type { USSDSession } from "../../types/ussd.types.js";
import { logger } from "../../utils/logger.util.js";
import { getCacheService } from "../cache.service.js";
import { CitizenService } from "../citizen.service.js";
import { SMSService } from "../sms.service.js";
import { USSDTemplateService } from "./ussd.template.service.js";

export class USSDService {
  private static ITEMS_PER_PAGE = USSD_ITEMS_PER_PAGE; // 8 items
  private static WARDS_PER_PAGE = USSD_ITEMS_PER_PAGE - 1; // 7 items (leaving room for Skip)

  private static get cache() {
    return getCacheService();
  }

  /**
   * Main USSD handler
   */
  static async handleUSSD(sessionId: string, phoneNumber: string, text: string): Promise<string> {
    try {
      logger.debug("Processing USSD request", { sessionId, phoneNumber, text });

      const normalizedPhone = SMSService.normalizePhoneNumber(phoneNumber);
      const session = await this.getSession(sessionId, normalizedPhone);

      const inputs = text.split("*").filter((input) => input.trim() !== "");
      const currentInput = inputs[inputs.length - 1] || "";

      logger.debug("Current session state", {
        sessionId,
        step: session.step,
        currentInput,
        allInputs: inputs,
      });

      return await this.routeRequest(session, currentInput, inputs);
    } catch (error) {
      const err = error as Error;
      logger.error("USSD Execution Failed", {
        error: err.message,
        stack: err.stack,
        sessionId,
        phoneNumber,
      });
      return USSDTemplateService.genericError();
    }
  }

  /**
   * Route USSD request to appropriate handler
   */
  private static async routeRequest(session: USSDSession, input: string, allInputs: string[]): Promise<string> {
    const { step } = session;

    try {
      switch (step) {
        case USSDStep.START:
          return await this.handleStart(session);

        case USSDStep.MAIN_MENU:
          return await this.handleMainMenu(session, input);

        case USSDStep.REGISTER_LANGUAGE:
          return await this.handleLanguageSelection(session, input);

        case USSDStep.REGISTER_FIRSTNAME:
          return await this.handleFirstName(session, input);

        case USSDStep.REGISTER_LASTNAME:
          return await this.handleLastName(session, input);

        case USSDStep.REGISTER_STATE:
          return await this.handleStateSelection(session, input);

        case USSDStep.REGISTER_LGA:
          return await this.handleLGASelection(session, input);

        case USSDStep.REGISTER_WARD:
          return await this.handleWardSelection(session, input);

        case USSDStep.REGISTER_CONFIRM:
          return await this.handleConfirmation(session, input);

        case USSDStep.UNSUBSCRIBE_CONFIRM:
          return await this.handleUnsubscribe(session, input);

        case USSDStep.HELP:
          return await this.handleHelp(session);

        default:
          logger.warn("Unknown USSD step encountered, resetting to start", {
            sessionId: session.sessionId,
            step,
          });
          return await this.handleStart(session);
      }
    } catch (error) {
      const err = error as Error;
      logger.error(`Error processing step ${step}`, {
        error: err.message,
        sessionId: session.sessionId,
      });
      return USSDTemplateService.serviceUnavailable();
    }
  }

  /**
   * Handle initial USSD session
   */
  private static async handleStart(session: USSDSession): Promise<string> {
    try {
      const existingCitizen = await CitizenService.getCitizenByPhone(session.phoneNumber);

      session.step = USSDStep.MAIN_MENU;

      if (existingCitizen.isOptedIn) {
        session.data.isRegistered = true;
        await this.saveSession(session);

        return USSDTemplateService.welcomeRegistered(existingCitizen.firstName, existingCitizen.state?.name || "Your State", existingCitizen.lga?.name || "Your LGA");
      } else {
        session.data.isRegistered = false;
        await this.saveSession(session);

        return USSDTemplateService.welcomeUnsubscribed(existingCitizen.firstName);
      }
    } catch (error) {
      logger.info(`New citizen registration starting for ${session.phoneNumber}`);
      session.step = USSDStep.REGISTER_LANGUAGE;
      session.data = {};
      await this.saveSession(session);

      return USSDTemplateService.welcomeNew();
    }
  }

  /**
   * Handle main menu selection
   */
  private static async handleMainMenu(session: USSDSession, input: string): Promise<string> {
    const citizen = await prisma.citizen.findUnique({
      where: { phoneNumber: session.phoneNumber },
    });

    if (!citizen) {
      logger.error("Citizen not found during main menu interaction", {
        phoneNumber: session.phoneNumber,
      });
      return USSDTemplateService.accountNotFound();
    }

    switch (input) {
      case "1":
        if (citizen.isOptedIn) {
          // Update Information
          session.step = USSDStep.REGISTER_FIRSTNAME;
          session.data.isUpdate = true;
          session.data.language = citizen.preferredLanguage;
          await this.saveSession(session);
          return USSDTemplateService.promptFirstName();
        } else {
          // Re-subscribe
          await prisma.citizen.update({
            where: { id: citizen.id },
            data: { isOptedIn: true },
          });

          logger.info("Citizen re-subscribed via USSD", {
            phoneNumber: session.phoneNumber,
          });

          SMSService.sendWelcomeSMS(session.phoneNumber, citizen.firstName).catch((e) => logger.error("Failed to send welcome SMS", { error: e.message }));

          return USSDTemplateService.resubscribeSuccess();
        }

      case "2":
        if (citizen.isOptedIn) {
          // Unsubscribe
          session.step = USSDStep.UNSUBSCRIBE_CONFIRM;
          await this.saveSession(session);
          return USSDTemplateService.unsubscribeConfirm();
        } else {
          // Update Information
          session.step = USSDStep.REGISTER_FIRSTNAME;
          session.data.isUpdate = true;
          session.data.language = citizen.preferredLanguage;
          await this.saveSession(session);
          return USSDTemplateService.promptFirstName();
        }

      case "3":
        session.step = USSDStep.HELP;
        await this.saveSession(session);
        return await this.handleHelp(session);

      case "0":
        await this.clearSession(session.sessionId);
        return USSDTemplateService.exitMessage();

      default:
        return citizen.isOptedIn ? USSDTemplateService.invalidMainMenuRegistered() : USSDTemplateService.invalidMainMenuUnsubscribed();
    }
  }

  /**
   * Handle language selection
   */
  private static async handleLanguageSelection(session: USSDSession, input: string): Promise<string> {
    const languageMap = USSDTemplateService.getLanguageMap();
    const selectedLanguage = languageMap[input];

    if (!selectedLanguage) {
      return USSDTemplateService.invalidLanguage();
    }

    session.data.language = selectedLanguage;
    session.step = USSDStep.REGISTER_FIRSTNAME;
    await this.saveSession(session);

    return USSDTemplateService.promptFirstName();
  }

  /**
   * Handle first name input
   */
  private static async handleFirstName(session: USSDSession, input: string): Promise<string> {
    if (!input || input.length < 2) {
      return USSDTemplateService.invalidName();
    }

    session.data.firstName = input;
    session.step = USSDStep.REGISTER_LASTNAME;
    await this.saveSession(session);

    return USSDTemplateService.promptLastName();
  }

  /**
   * Handle last name input
   */
  private static async handleLastName(session: USSDSession, input: string): Promise<string> {
    if (!input || input.length < 2) {
      return USSDTemplateService.invalidLastName();
    }

    session.data.lastName = input;
    session.step = USSDStep.REGISTER_STATE;
    session.data.currentPage = 0;
    await this.saveSession(session);

    return await this.showStatesPage(session, 0);
  }

  /**
   * Show paginated states
   */
  private static async showStatesPage(session: USSDSession, page: number): Promise<string> {
    const states = await this.cache.getOrSet(
      cacheConstants.keys.REFERENCE.STATES,
      "all",
      async () => {
        return prisma.state.findMany({
          orderBy: { name: "asc" },
        });
      },
      cacheConstants.ttl.WEEK,
    );

    const totalPages = Math.ceil(states.length / this.ITEMS_PER_PAGE);
    const startIdx = page * this.ITEMS_PER_PAGE;
    const endIdx = startIdx + this.ITEMS_PER_PAGE;
    const pageStates = states.slice(startIdx, endIdx);

    return USSDTemplateService.statesPage(pageStates, page, totalPages, page > 0, page < totalPages - 1);
  }

  /**
   * Handle state selection with pagination
   */
  private static async handleStateSelection(session: USSDSession, input: string): Promise<string> {
    const page = session.data.currentPage || 0;
    const choice = parseInt(input);

    if (isNaN(choice)) {
      return await this.showStatesPage(session, page);
    }

    const states = (await this.cache.get<any[]>(cacheConstants.keys.REFERENCE.STATES, "all")) || [];
    const totalPages = Math.ceil(states.length / this.ITEMS_PER_PAGE);

    // Navigation: 9 = Previous/Next (first page), 0 = Next
    if (choice === 9) {
      if (page > 0) {
        session.data.currentPage = page - 1;
        await this.saveSession(session);
        return await this.showStatesPage(session, page - 1);
      } else if (page < totalPages - 1) {
        session.data.currentPage = page + 1;
        await this.saveSession(session);
        return await this.showStatesPage(session, page + 1);
      }
    }

    if (choice === 0 && page > 0 && page < totalPages - 1) {
      session.data.currentPage = page + 1;
      await this.saveSession(session);
      return await this.showStatesPage(session, page + 1);
    }

    // Select state (1-8)
    if (choice < 1 || choice > 8) {
      return USSDTemplateService.invalidSelection();
    }

    const stateIndex = page * this.ITEMS_PER_PAGE + (choice - 1);
    const selectedState = states[stateIndex];

    if (!selectedState) {
      return USSDTemplateService.invalidStateSelection();
    }

    session.data.stateId = selectedState.id;
    session.data.stateName = selectedState.name;
    session.data.currentPage = 0;
    session.step = USSDStep.REGISTER_LGA;
    await this.saveSession(session);

    return await this.showLGAsPage(session, selectedState.id, 0);
  }

  /**
   * Show paginated LGAs
   */
  private static async showLGAsPage(session: USSDSession, stateId: string, page: number): Promise<string> {
    const lgas = await this.cache.getOrSet(
      cacheConstants.keys.REFERENCE.LGAS,
      stateId,
      async () => {
        return prisma.lGA.findMany({
          where: { stateId },
          orderBy: { name: "asc" },
        });
      },
      cacheConstants.ttl.WEEK,
    );

    const totalPages = Math.ceil(lgas.length / this.ITEMS_PER_PAGE);
    const startIdx = page * this.ITEMS_PER_PAGE;
    const endIdx = startIdx + this.ITEMS_PER_PAGE;
    const pageLGAs = lgas.slice(startIdx, endIdx);

    return USSDTemplateService.lgasPage(pageLGAs, session.data.stateName!, page, totalPages, page > 0, page < totalPages - 1);
  }

  /**
   * Handle LGA selection with pagination
   */
  private static async handleLGASelection(session: USSDSession, input: string): Promise<string> {
    const page = session.data.currentPage || 0;
    const choice = parseInt(input);

    if (isNaN(choice)) {
      return await this.showLGAsPage(session, session.data.stateId!, page);
    }

    const lgas = (await this.cache.get<any[]>(cacheConstants.keys.REFERENCE.LGAS, session.data.stateId as string)) || [];
    const totalPages = Math.ceil(lgas.length / this.ITEMS_PER_PAGE);

    // Navigation
    if (choice === 9) {
      if (page > 0) {
        session.data.currentPage = page - 1;
        await this.saveSession(session);
        return await this.showLGAsPage(session, session.data.stateId!, page - 1);
      } else if (page < totalPages - 1) {
        session.data.currentPage = page + 1;
        await this.saveSession(session);
        return await this.showLGAsPage(session, session.data.stateId!, page + 1);
      }
    }

    if (choice === 0 && page > 0 && page < totalPages - 1) {
      session.data.currentPage = page + 1;
      await this.saveSession(session);
      return await this.showLGAsPage(session, session.data.stateId!, page + 1);
    }

    // Select LGA (1-8)
    if (choice < 1 || choice > 8) {
      return USSDTemplateService.invalidSelection();
    }

    const lgaIndex = page * this.ITEMS_PER_PAGE + (choice - 1);
    const selectedLGA = lgas[lgaIndex];

    if (!selectedLGA) {
      return USSDTemplateService.invalidLGASelection();
    }

    session.data.lgaId = selectedLGA.id;
    session.data.lgaName = selectedLGA.name;
    session.data.currentPage = 0;
    session.step = USSDStep.REGISTER_WARD;
    await this.saveSession(session);

    return await this.showWardsPage(session, selectedLGA.id, 0);
  }

  /**
   * Show paginated Wards
   */
  private static async showWardsPage(session: USSDSession, lgaId: string, page: number): Promise<string> {
    const wards = await this.cache.getOrSet(
      cacheConstants.keys.REFERENCE.WARDS,
      lgaId,
      async () => {
        return prisma.ward.findMany({
          where: { lgaId },
          orderBy: { name: "asc" },
        });
      },
      cacheConstants.ttl.WEEK,
    );

    if (wards.length === 0) {
      session.step = USSDStep.REGISTER_CONFIRM;
      await this.saveSession(session);
      return this.showConfirmation(session);
    }

    const totalPages = Math.ceil(wards.length / this.WARDS_PER_PAGE);
    const startIdx = page * this.WARDS_PER_PAGE;
    const endIdx = startIdx + this.WARDS_PER_PAGE;
    const pageWards = wards.slice(startIdx, endIdx);

    return USSDTemplateService.wardsPage(pageWards, session.data.lgaName!, page, totalPages, page > 0, page < totalPages - 1);
  }

  /**
   * Handle ward selection with pagination
   */
  private static async handleWardSelection(session: USSDSession, input: string): Promise<string> {
    if (input === "8") {
      // Skip ward
      session.data.wardId = null;
      session.step = USSDStep.REGISTER_CONFIRM;
      await this.saveSession(session);
      return this.showConfirmation(session);
    }

    const page = session.data.currentPage || 0;
    const choice = parseInt(input);

    if (isNaN(choice)) {
      return await this.showWardsPage(session, session.data.lgaId!, page);
    }

    const wards = (await this.cache.get<any[]>(cacheConstants.keys.REFERENCE.WARDS, session.data.lgaId!)) || [];

    const totalPages = Math.ceil(wards.length / this.WARDS_PER_PAGE);

    // Navigation: 9 = Previous, 0 = Next
    if (choice === 9 && page > 0) {
      session.data.currentPage = page - 1;
      await this.saveSession(session);
      return await this.showWardsPage(session, session.data.lgaId!, page - 1);
    }

    if (choice === 0 && page < totalPages - 1) {
      session.data.currentPage = page + 1;
      await this.saveSession(session);
      return await this.showWardsPage(session, session.data.lgaId!, page + 1);
    }

    // Select Ward (1-7)
    if (choice < 1 || choice > 7) {
      return USSDTemplateService.invalidWardNavigation();
    }

    const wardIndex = page * this.WARDS_PER_PAGE + (choice - 1);
    const selectedWard = wards[wardIndex];

    if (!selectedWard) {
      return USSDTemplateService.invalidWardSelection();
    }

    session.data.wardId = selectedWard.id;
    session.data.wardName = selectedWard.name;
    session.step = USSDStep.REGISTER_CONFIRM;
    await this.saveSession(session);

    return this.showConfirmation(session);
  }

  /**
   * Show confirmation screen
   */
  private static showConfirmation(session: USSDSession): string {
    const data = {
      firstName: session.data.firstName as string,
      lastName: session.data.lastName as string,
      stateName: session.data.stateName as string,
      lgaName: session.data.lgaName as string,
      wardName: session.data.wardName as string,
      language: session.data.language as Language,
    };

    return session.data.isUpdate ? USSDTemplateService.confirmationUpdate(data) : USSDTemplateService.confirmationRegistration(data);
  }

  /**
   * Handle registration/update confirmation
   */
  private static async handleConfirmation(session: USSDSession, input: string): Promise<string> {
    if (input === "2") {
      await this.clearSession(session.sessionId);
      logger.info("USSD Registration cancelled by user", {
        phoneNumber: session.phoneNumber,
      });
      return USSDTemplateService.registrationCancelled();
    }

    if (input !== "1") {
      return USSDTemplateService.invalidConfirmation(!!session.data.isUpdate);
    }

    try {
      const citizenData = {
        firstName: session.data.firstName!,
        lastName: session.data.lastName!,
        stateId: session.data.stateId!,
        lgaId: session.data.lgaId!,
        wardId: session.data.wardId!,
        preferredLanguage: session.data.language!,
      };
      if (session.data.isUpdate) {
        await CitizenService.updateCitizen(session.phoneNumber, citizenData);
        await this.cache.delete(cacheConstants.keys.CITIZEN.BY_PHONE, session.phoneNumber);

        logger.info("Citizen information updated via USSD", {
          phoneNumber: session.phoneNumber,
        });

        await this.clearSession(session.sessionId);
        return USSDTemplateService.updateSuccess();
      } else {
        await CitizenService.registerCitizen({
          phoneNumber: session.phoneNumber,
          ...citizenData,
        });

        logger.info("New citizen registered via USSD", {
          phoneNumber: session.phoneNumber,
        });

        await this.clearSession(session.sessionId);
        return USSDTemplateService.registrationSuccess(session.data.firstName!);
      }
    } catch (error) {
      const err = error as Error;
      logger.error("Failed to register/update citizen via USSD", {
        error: err.message,
        isUpdate: session.data.isUpdate,
      });
      return USSDTemplateService.operationFailed();
    }
  }

  /**
   * Handle unsubscribe confirmation
   */
  private static async handleUnsubscribe(session: USSDSession, input: string): Promise<string> {
    if (input === "2") {
      await this.clearSession(session.sessionId);
      return USSDTemplateService.unsubscribeCancelled();
    }

    if (input !== "1") {
      return USSDTemplateService.invalidUnsubscribe();
    }

    try {
      await CitizenService.toggleOptIn(session.phoneNumber, false);
      await this.clearSession(session.sessionId);
      return USSDTemplateService.unsubscribeSuccess();
    } catch (error) {
      logger.error("Failed to unsubscribe citizen", { error });
      return USSDTemplateService.unsubscribeFailed();
    }
  }

  /**
   * Handle help menu
   */
  private static async handleHelp(session: USSDSession): Promise<string> {
    await this.clearSession(session.sessionId);
    return USSDTemplateService.help();
  }

  /**
   * Get or create USSD session
   */
  private static async getSession(sessionId: string, phoneNumber: string): Promise<USSDSession> {
    const cacheKey = `${cacheConstants.keys.USSD.SESSION}:${sessionId}`;
    const cached = await this.cache.get<USSDSession>(cacheConstants.keys.USSD.SESSION, cacheKey);

    if (cached) {
      logger.debug("Retrieved existing session from cache", {
        sessionId,
        step: cached.step,
      });
      return cached;
    }

    const newSession: USSDSession = {
      sessionId,
      phoneNumber,
      step: USSDStep.START,
      data: {},
    };

    logger.debug("Created new session", { sessionId });
    await this.saveSession(newSession);
    return newSession;
  }

  /**
   * Save USSD session to cache
   */
  private static async saveSession(session: USSDSession): Promise<void> {
    const cacheKey = `${cacheConstants.keys.USSD.SESSION}:${session.sessionId}`;
    logger.debug("Saving session", {
      sessionId: session.sessionId,
      step: session.step,
      dataKeys: Object.keys(session.data),
    });
    await this.cache.set(cacheConstants.keys.USSD.SESSION, cacheKey, session, cacheConstants.ttl.SHORT);
  }

  /**
   * Clear USSD session
   */
  private static async clearSession(sessionId: string): Promise<void> {
    const cacheKey = `ussd:session:${sessionId}`;
    logger.debug("Clearing session", { sessionId });
    await this.cache.delete(cacheConstants.keys.USSD.SESSION, cacheKey);
  }
}
