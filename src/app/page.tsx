"use client";

import { useState, useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Png } from "@/lib/png";
import { ChevronUp, ChevronDown } from "lucide-react";
import {
  CollapsibleContent,
  Collapsible,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Card {
  id: string;
  name: string;
  first_mes: string;
  description: string;
  personality: string;
  mes_example: string;
  scenario: string;
  avatarUrl?: string;
}

export default function Home() {
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(
    null
  );
  const [characterUrl, setCharacterUrl] = useState("");
  const [avatarPath, setAvatarPath] = useState("");
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchCards = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch("/api/proxy");
      const data = await response.json();
      if (data.cards) {
        setCards((prevCards) => {
          return data.cards.map((newCard: Card) => ({
            ...newCard,
            avatarUrl:
              prevCards.find((c) => c.id === newCard.id)?.avatarUrl ||
              newCard.avatarUrl,
          }));
        });
      }
    } catch (error) {
      console.error("Error fetching cards:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, []);

  const downloadJson = (card: Card) => {
    const element = document.createElement("a");
    const file = new Blob([JSON.stringify(card, null, 2)], {
      type: "application/json",
    });
    element.href = URL.createObjectURL(file);
    element.download = `${card.name.replace(/\s+/g, "_")}.json`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadPng = async (card: Card, cardId: string) => {
    if (!card.avatarUrl) return;

    try {
      const img = new Image();
      img.src = `/api/proxy/image?url=${encodeURIComponent(card.avatarUrl)}`;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      ctx.drawImage(img, 0, 0);
      const pngBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else throw new Error("Could not convert to PNG");
        }, "image/png");
      });

      const arrayBuffer = await pngBlob.arrayBuffer();

      const cardData = JSON.stringify({
        name: card.name,
        first_mes: card.first_mes,
        description: card.description,
        personality: card.personality,
        mes_example: card.mes_example,
        scenario: card.scenario,
      });

      const newImageData = Png.Generate(arrayBuffer, cardData);
      const newFileName = `${
        card.name.replace(/\s+/g, "_") || "character"
      }.png`;
      const newFile = new File([newImageData], newFileName, {
        type: "image/png",
      });

      const link = URL.createObjectURL(newFile);
      const a = document.createElement("a");
      a.download = newFileName;
      a.href = link;
      a.click();

      URL.revokeObjectURL(link);
    } catch (error) {
      console.error("Error generating PNG:", error);
      alert("Couldn't export this character card, sorry.");
    }
  };

  const handleOpenDialog = (index: number) => {
    setSelectedCardIndex(index);
    setDialogOpen(true);
    setCharacterUrl("");
    setAvatarPath("");
    setIsMetadataOpen(false);
  };

  const handleOpenMetadata = () => {
    const match = characterUrl.match(/characters\/([\w-]+)/);
    if (match && match[1]) {
      const characterId = match[1].split("_")[0];
      window.open(
        `https://janitorai.com/hampter/characters/${characterId}`,
        "_blank"
      );
      setIsMetadataOpen(true);
    }
  };

  const handleFetchAvatar = async () => {
    if (selectedCardIndex === null) return;

    try {
      const avatarUrl = `https://ella.janitorai.com/bot-avatars/${avatarPath}`;
      const updatedCards = [...cards];
      updatedCards[selectedCardIndex] = {
        ...updatedCards[selectedCardIndex],
        avatarUrl,
      };
      setCards(updatedCards);
      setDialogOpen(false);
    } catch (error) {
      console.error("Error fetching avatar:", error);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold">Sucker v1.3</h1>
            <p className="text-sm text-muted-foreground">
              I still hate making these changes, but Mooth found a bug so I fixed it. 
            </p>
          </div>
          <Button
            onClick={fetchCards}
            variant="outline"
            disabled={isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <Separator className="my-4" />

        <Collapsible
          open={isInstructionsOpen}
          onOpenChange={setIsInstructionsOpen}
          className="w-full mb-8"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">How to Use</h2>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-9 p-0">
                {isInstructionsOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                <span className="sr-only">Toggle instructions</span>
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="mt-4">
            <div className="prose dark:prose-invert max-w-none">
              <p className="mb-2">
                Follow every instruction here to the letter because it's all you
                need to know and I have no intent of helping you further.
              </p>
              <ol className="list-decimal list-inside">
                <li className="mb-2">
                  Put <code>https://sucker.severian.dev/api/proxy</code> in your
                  API settings, any value for model and key.
                </li>
                <li className="mb-2">
                  <span className="line-through">
                    Remove your custom prompt - otherwise, it'll get inserted
                    into cards, on the example message section.
                  </span>
                  <span>
                    &nbsp;No need for this anymore. At least the new prompt system has
                    it separate now.
                  </span>
                </li>
                <li className="mb-2">
                  Save settings and refresh the page. Not this page. <i>That</i>{" "}
                  page.
                </li>
                <li className="mb-2">
                  Start a new chat with a character or multiple. Send any
                  message.
                </li>
                <li className="mb-2">
                  Hit the Refresh button here, and the cards should appear here.
                </li>
                <li className="mb-2">
                  Download the JSON files or go through a little more effort to
                  get PNGs instead.
                </li>
              </ol>
              <p className="mb-2">
                Extractions will only last for 10 minutes, after which they're
                discarded. Reloading the page will remove any attached avatars.
                I'm not storing shit.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="max-w-3xl mx-auto space-y-6">
          {cards.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <p>No extractions yet.</p>
              </CardContent>
            </Card>
          ) : (
            cards.map((card, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value={`card-${index}`}>
                      <AccordionTrigger className="text-xl font-semibold">
                        {card.name || "Unnamed Card"}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div id={`card-${index}`} className="space-y-4 mt-4">
                          {card.description && (
                            <Accordion type="single" collapsible>
                              <AccordionItem value="description">
                                <AccordionTrigger>Description</AccordionTrigger>
                                <AccordionContent>
                                  {card.description}
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          )}
                          {card.first_mes && (
                            <Accordion type="single" collapsible>
                              <AccordionItem value="first-message">
                                <AccordionTrigger>
                                  First Message
                                </AccordionTrigger>
                                <AccordionContent>
                                  {card.first_mes}
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          )}
                          {card.scenario && (
                            <Accordion type="single" collapsible>
                              <AccordionItem value="scenario">
                                <AccordionTrigger>Scenario</AccordionTrigger>
                                <AccordionContent>
                                  {card.scenario}
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          )}
                          {card.mes_example && (
                            <Accordion type="single" collapsible>
                              <AccordionItem value="example-messages">
                                <AccordionTrigger>
                                  Example Messages
                                </AccordionTrigger>
                                <AccordionContent>
                                  {card.mes_example}
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  <div className="flex flex-row space-x-2 mt-6">
                    <Button
                      onClick={() => downloadJson(card)}
                      variant="default"
                    >
                      Download JSON
                    </Button>
                    {!card.avatarUrl ? (
                      <Button
                        onClick={() => handleOpenDialog(index)}
                        variant="outline"
                      >
                        Fetch Avatar (required for PNG)
                      </Button>
                    ) : (
                      <Button
                        onClick={() => downloadPng(card, `card-${index}`)}
                        variant="default"
                        disabled={!card.avatarUrl}
                      >
                        Download PNG
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isMetadataOpen ? "Enter Avatar Path" : "Enter Character URL"}
            </DialogTitle>
            <DialogDescription>
              {isMetadataOpen
                ? "Look for the avatar field in the opened tab and paste the value here."
                : "Enter the Janitor character URL (https://janitorai.com/characters/...)."}
            </DialogDescription>
          </DialogHeader>

          {isMetadataOpen ? (
            <div className="space-y-4">
              <Input
                placeholder="id.webp"
                value={avatarPath}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setAvatarPath(e.target.value)
                }
              />
              <Button onClick={handleFetchAvatar} className="w-full">
                Fetch Avatar
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Input
                placeholder="https://janitorai.com/characters/..."
                value={characterUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setCharacterUrl(e.target.value)
                }
              />
              <p className="text-sm text-muted-foreground">
                Upon clicking this button, a new tab will open with the
                character's metadata. Look for the avatar field and copy the
                value before returning to this page.
              </p>
              <Button onClick={handleOpenMetadata} className="w-full">
                Open Metadata
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
