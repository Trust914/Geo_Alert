import { prisma } from "../lib/prisma";
import { JWTService } from "../services/jwt.service";
import type { IAgencyWithAdmin } from "../types/agency.types";
import type { IAlertData } from "../types/alert.types";
import type { IAuthUser } from "../types/auth.types";
import type { ICitizenData, ICitizenNearbyData } from "../types/citizen.types";
import type { IAgencyWelcomeData } from "../types/email.types";
import type { ISafeUser } from "../types/user.types";
import { AppError } from "../utils/error.util";

/**
 * Helper: Maps raw Prisma result to Strict Agency Data
 * Eliminates usage of 'any' and prevents leaking user arrays
 */
export const mapToAgencyData = (rawAgency: any): IAgencyWithAdmin => {
  return {
    id: rawAgency.id,
    name: rawAgency.name,
    type: rawAgency.type,
    jurisdiction: rawAgency.jurisdiction,
    jurisdictionLevel: rawAgency.jurisdictionLevel,
    contactEmail: rawAgency.contactEmail,
    contactPhone: rawAgency.contactPhone,
    status: rawAgency.status,
    createdAt: rawAgency.createdAt,
    updatedAt: rawAgency.updatedAt,
    // Logic: Take the first admin from the array, or null
    admin: {
      id: rawAgency.users[0].id,
      firstName: rawAgency.users[0].firstName,
      lastName: rawAgency.users[0].lastName,
      email: rawAgency.users[0].email,
      mustChangePassword: rawAgency.users[0].mustChangePassword,
      requiresActivation: rawAgency.users[0].requiresActivation,
      // isActive: rawAgency.users[0].isActive
    },
    _count: {
      users: rawAgency._count?.users ?? 0,
      alerts: rawAgency._count?.alerts ?? 0,
    },
  };
};

/**
 * Helper: Map raw Prisma Alert to Strict IAlertData
 */
export const mapToAlertData = (raw: any): IAlertData => {
  return {
    id: raw.id,
    agencyId: raw.agencyId,
    createdByUserId: raw.createdByUserId,
    category: raw.category,
    severity: raw.severity,
    urgency: raw.urgency,
    headline: raw.headline,
    description: raw.description,
    instruction: raw.instruction,
    capXml: raw.capXml,
    status: raw.status,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    expiresAt: raw.expiresAt,
    sentAt: raw.sentAt,
    cancelledAt: raw.cancelledAt,
    cancelReason: raw.cancelReason,

    ...(raw.agency && {
      agency: {
        id: raw.agency.id,
        name: raw.agency.name,
        type: raw.agency.type,
      },
    }),

    ...(raw.createdBy && {
      createdBy: {
        id: raw.createdBy.id,
        firstName: raw.createdBy.firstName,
        lastName: raw.createdBy.lastName,
        email: raw.createdBy.email,
      },
    }),

    ...(raw.cancelledBy && {
      cancelledBy: {
        id: raw.cancelledBy.id,
        firstName: raw.cancelledBy.firstName,
        lastName: raw.cancelledBy.lastName,
        email: raw.cancelledBy.email,
      },
    }),

    ...(raw.sentBy && {
      sentBy: {
        id: raw.sentBy.id,
        firstName: raw.sentBy.firstName,
        lastName: raw.sentBy.lastName,
        email: raw.sentBy.email,
      },
    }),

    ...(raw.targets && {
      targets: raw.targets.map((t: any) => ({
        id: t.id,
        targetType: t.targetType,
        estimatedRecipients: t.estimatedRecipients,
        radiusMeters: t.radiusMeters,
        locationName: t.state?.name || t.lga?.name || t.ward?.name || "Custom Area",
      })),
    }),

    ...(raw._count && {
      metrics: {
        deliveriesCount: raw._count.deliveries,
      },
    }),
  };
};

export const mapUser = (raw: any): IAuthUser => {
  return {
    id: raw.id,
    email: raw.email,
    firstName: raw.firstName,
    lastName: raw.lastName,
    role: raw.role,
    agencyId: raw.agencyId,
    mustChangePassword: raw.mustChangePassword,
    isTwoFactorEnabled: raw.isTwoFactorEnabled,
    twoFactorMethod: raw.twoFactorMethod,

    // Handle Agency Relation safely
    ...(raw.agency && {
      agency: {
        id: raw.agency.id,
        name: raw.agency.name,
        type: raw.agency.type,
        jurisdictionLevel: raw.agency.jurisdictionLevel,
      },
    }),
  };
};

/**
 * MAPPER 1: Converts Prisma Object -> Strict ICitizenData
 */
export const mapToCitizenData = (raw: any): ICitizenData => {
  return {
    id: raw.id,
    phoneNumber: raw.phoneNumber,
    firstName: raw.firstName,
    lastName: raw.lastName,
    preferredLanguage: raw.preferredLanguage,
    isOptedIn: raw.isOptedIn,
    registeredAt: raw.registeredAt,
    updatedAt: raw.updatedAt,
    location: raw.location, // GeoJSON Point or null

    // Ensure relations exist before accessing
    state: {
      id: raw.state?.id || raw.stateId,
      name: raw.state?.name || "Unknown",
    },
    lga: {
      id: raw.lga?.id || raw.lgaId,
      name: raw.lga?.name || "Unknown",
    },
    ward: raw.ward
      ? {
          id: raw.ward.id,
          name: raw.ward.name,
        }
      : null,
  };
};

/**
 * MAPPER 2: Converts Raw SQL (Snake Case) -> Strict ICitizenNearbyData
 */
export const mapRawToCitizenNearby = (raw: any): ICitizenNearbyData => {
  return {
    id: raw.id,
    phoneNumber: raw.phone_number, // SQL returns snake_case
    firstName: raw.first_name,
    lastName: raw.last_name,
    preferredLanguage: raw.preferred_language,
    isOptedIn: raw.is_opted_in,
    distanceMeters: raw.distance || 0,
    //   state: { id: "unknown", name: "Unknown" }, // Raw query didn't join state
    //   lga: { id: "unknown", name: "Unknown" },   // Raw query didn't join LGA
  };
};

export const mapToSafeUser = (raw: any): ISafeUser => {
  return {
    id: raw.id,
    email: raw.email,
    firstName: raw.firstName,
    lastName: raw.lastName,
    role: raw.role,
    agencyId: raw.agencyId,
    mustChangePassword: raw.mustChangePassword,
    emailVerified: raw.emailVerified,
    isTwoFactorEnabled: raw.isTwoFactorEnabled,
    twoFactorMethod: raw.twoFactorMethod,
    lastLoginAt: raw.lastLoginAt,
    isActive: raw.isActive,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,

    ...(raw.agency && {
      agency: {
        id: raw.agency.id,
        name: raw.agency.name,
        type: raw.agency.type,
        jurisdictionLevel: raw.agency.jurisdictionLevel,
        status: raw.agency.status,
      },
    }),
  };
};

export const verifyUserPassword = async (userId: string, passwordString: string): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user) throw AppError.notFound("User not found");

  const isValid = await JWTService.verifyPasswordArgon2(user.passwordHash!, passwordString);

  if (!isValid) {
    throw AppError.unauthorized("Invalid password", "TwoFactorService");
  }

  return true;
};
