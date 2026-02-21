import { create } from "xmlbuilder2";
import type { AlertCategory, AlertStatus, Severity, Urgency } from "../prisma/prisma/generated/enums.js";
import type { CAPAlertData } from "../types/alert.types.js";

export class CAPXMLGenerator {
  /**
   * Generate CAP 1.2 compliant XML
   */
  static generate(data: CAPAlertData): string {
    const root = create({ version: "1.0", encoding: "UTF-8" })
      .ele("alert", { xmlns: "urn:oasis:names:tc:emergency:cap:1.2" })
      .ele("identifier")
      .txt(data.identifier)
      .up()
      .ele("sender")
      .txt(data.sender)
      .up()
      .ele("sent")
      .txt(data.sent.toISOString())
      .up()
      .ele("status")
      .txt(data.status)
      .up()
      .ele("msgType")
      .txt(data.msgType)
      .up()
      .ele("scope")
      .txt(data.scope)
      .up();

    // Add info block
    const info = root.ele("info");

    info
      .ele("category")
      .txt(this.mapCategory(data.category))
      .up()
      .ele("event")
      .txt(data.event)
      .up()
      .ele("urgency")
      .txt(data.urgency)
      .up()
      .ele("severity")
      .txt(data.severity)
      .up()
      .ele("certainty")
      .txt(data.certainty)
      .up()
      .ele("headline")
      .txt(data.headline)
      .up()
      .ele("description")
      .txt(data.description)
      .up();

    // Optional instruction
    if (data.instruction) {
      info.ele("instruction").txt(data.instruction).up();
    }

    // Optional web
    if (data.web) {
      info.ele("web").txt(data.web).up();
    }

    // Optional contact
    if (data.contact) {
      info.ele("contact").txt(data.contact).up();
    }

    // Area block
    const area = info.ele("area");
    area.ele("areaDesc").txt(data.areaDesc).up();

    // Optional polygon
    if (data.polygon) {
      area.ele("polygon").txt(data.polygon).up();
    }

    // Optional circle
    if (data.circle) {
      area.ele("circle").txt(data.circle).up();
    }

    return root.end({ prettyPrint: true });
  }

  /**
   * Validate CAP XML against schema
   */
  static validate(xml: string): boolean {
    try {
      // Basic validation - check for required elements
      const requiredElements = ["<identifier>", "<sender>", "<sent>", "<status>", "<msgType>", "<scope>", "<info>", "<category>", "<event>", "<urgency>", "<severity>", "<certainty>", "<headline>", "<description>"];

      return requiredElements.every((element) => xml.includes(element));
    } catch (error) {
      return false;
    }
  }

  /**
   * Parse CAP XML to object
   */
  static parse(xml: string): any {
    try {
      const doc = create(xml);
      // Parse logic here
      return doc;
    } catch (error) {
      throw new Error(`Failed to parse CAP XML: ${error}`);
    }
  }

  /**
   * Map internal category to CAP category
   */
  private static mapCategory(category: AlertCategory): string {
    const categoryMap: Record<AlertCategory, string> = {
      GEOPHYSICAL: "Geophysical",
      METEOROLOGICAL: "Meteorological",
      SAFETY: "General emergency and public safety",
      SECURITY: "Law enforcement, military, homeland and local/private security",
      RESCUE: "Rescue and recovery",
      FIRE: "Fire suppression and rescue",
      HEALTH: "Public health",
      ENVIRONMENTAL: "Environmental",
      TRANSPORT: "Transport and infrastructure",
      INFRASTRUCTURE: "Infrastructure",
      CBRNE: "CBRNE",
      WEATHER: "Weather",
      OTHER: "Other events",
    };

    return categoryMap[category] || "Other events";
  }

  /**
   * Generate polygon string from coordinates
   */
  static generatePolygon(coordinates: Array<{ lat: number; lon: number }>): string {
    return coordinates.map((coord) => `${coord.lat},${coord.lon}`).join(" ");
  }

  /**
   * Generate circle string from center point and radius
   */
  static generateCircle(center: { lat: number; lon: number }, radiusKm: number): string {
    return `${center.lat},${center.lon} ${radiusKm}`;
  }

  /**
   * Calculate SMS character count for alert
   */
  static calculateSMSLength(
    headline: string,
    description: string,
  ): {
    length: number;
    messageCount: number;
  } {
    const message = `⚠️ GEOALERT\n\n${headline}\n\n${description}\n\nStay safe and follow instructions from authorities.`;
    const length = message.length;
    const messageCount = Math.ceil(length / 160);

    return { length, messageCount };
  }

  /**
   * Truncate description to fit SMS limit
   */
  static truncateForSMS(headline: string, description: string, maxLength: number = 918): string {
    const prefix = "⚠️ GEOALERT\n\n";
    const suffix = "\n\nStay safe and follow instructions from authorities.";
    const headlineSection = `${headline}\n\n`;

    const availableLength = maxLength - prefix.length - headlineSection.length - suffix.length;

    if (description.length <= availableLength) {
      return `${prefix}${headlineSection}${description}${suffix}`;
    }

    const truncated = description.substring(0, availableLength - 3) + "...";
    return `${prefix}${headlineSection}${truncated}${suffix}`;
  }
}
