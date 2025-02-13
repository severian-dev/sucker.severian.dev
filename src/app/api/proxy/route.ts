import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

interface StoredCard extends CardData {
  timestamp: number;
  id: string;
}

let extractedCards: StoredCard[] = [];
const EXPIRY_TIME = 10 * 60 * 1000;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function cleanupExpiredCards() {
  const now = Date.now();
  extractedCards = extractedCards.filter(
    (card) => now - card.timestamp < EXPIRY_TIME
  );
}

interface Message {
  content: string;
}

interface CardData {
  name: string;
  first_mes: string;
  description: string;
  personality: string;
  mes_example: string;
  scenario: string;
}

interface PersonaMatch {
  tag: string;
  content: string;
}

function findTagsBetween(content: string, startMarker: string, endMarker: string): PersonaMatch[] {
  console.log("Starting findTagsBetween with markers:", startMarker, endMarker);
  console.log("Content length:", content.length);
  console.log("First 100 chars of content:", content.substring(0, 100));
  
  const startMarkerTag = `<${startMarker}>`;
  const endMarkerTag = `<${endMarker}>`;
  
  const startIdx = content.indexOf(startMarkerTag);
  console.log("Start marker index:", startIdx);
  if (startIdx === -1) {
    console.log("Start marker not found");
    return [];
  }
  
  const endIdx = content.indexOf(endMarkerTag);
  console.log("End marker index:", endIdx);
  if (endIdx === -1) {
    console.log("End marker not found");
    return [];
  }
  
  const section = content.slice(startIdx, endIdx);
  console.log("Section length:", section.length);
  console.log("Section found:", section);
  
  const matches: PersonaMatch[] = [];
  
  const tagPattern = /<([^/>\s][^>]*)>([\s\S]*?)<\/\1>/g;
  console.log("Using pattern:", tagPattern);
  let match;
  
  try {
    while ((match = tagPattern.exec(section)) !== null) {
      console.log("Found match:", {
        fullMatch: match[0],
        tag: match[1],
        contentPreview: match[2].substring(0, 50) + "..."
      });
      matches.push({
        tag: match[1].trim(),
        content: match[2].trim()
      });
    }
  } catch (error) {
    console.error("Error during regex execution:", error);
  }
  
  console.log("Total matches found:", matches.length);
  console.log("Matches:", matches);
  return matches;
}

function extractBetweenTags(content: string, tag: string): string {
  const startTag = `<${tag}>`;
  const endTag = `</${tag}>`;
  const startIndex = content.indexOf(startTag);
  if (startIndex === -1) return "";
  
  const endIndex = content.indexOf(endTag, startIndex);
  if (endIndex === -1) return "";
  
  return content.slice(startIndex + startTag.length, endIndex).trim();
}

function safeReplace(text: string, old: string, newStr: string): string {
  return old ? text.replace(new RegExp(old, "g"), newStr) : text;
}

function extractCardData(messages: Message[]): CardData {
  console.log("Starting extractCardData");
  console.log("Messages length:", messages.length);
  
  const content0 = messages[0].content;
  const content1 = messages[2].content;
  
  console.log("Content0 length:", content0.length);
  console.log("Content1 length:", content1.length);

  // Find all persona tags between system and scenario, take the last one as character
  console.log("Finding personas between system and scenario");
  const personas = findTagsBetween(content0, "system", "scenario");
  console.log("Found personas:", personas);
  
  const charPersona = personas[personas.length - 1];
  console.log("Selected char persona:", charPersona);
  const charName = charPersona?.tag || "";
  console.log("Char name:", charName);

  // Initialize card data with the character name
  let cardData: CardData = {
    name: charName,
    description: charPersona?.content || "",
    scenario: extractBetweenTags(content0, "scenario"),
    mes_example: extractBetweenTags(content0, "example_dialogs"),
    personality: "", // This field isn't used in the new format
    first_mes: content1,
  };

  console.log("Initial card data:", cardData);

  // Replace character name with placeholder in all fields
  for (const field in cardData) {
    if (field !== "name") {
      const val = cardData[field as keyof CardData];
      if (typeof val === "string") {
        cardData[field as keyof CardData] = safeReplace(val, charName, "{{char}}");
      }
    }
  }

  console.log("Final card data:", cardData);
  return cardData;
}

export async function POST(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    console.log("Received POST request");
    const body = await request.json();
    console.log("Request body received");

    if (!body.messages || body.messages.length < 2) {
      console.log("Invalid request - missing messages or insufficient count");
      return NextResponse.json(
        { error: "Missing messages or insufficient message count" },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    console.log("Processing card data");
    const cardData = extractCardData(body.messages);
    console.log("Card data processed");
    
    extractedCards.push({
      ...cardData,
      timestamp: Date.now(),
      id: generateId(),
    });

    cleanupExpiredCards();

    return NextResponse.json(
      { status: "Card stored successfully" },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Error processing request:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    return NextResponse.json(
      { error: "Internal server error" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}

export async function GET() {
  cleanupExpiredCards();

  return NextResponse.json(
    {
      status: "online",
      cards: extractedCards.map(({ timestamp, ...card }) => card),
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
