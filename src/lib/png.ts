import * as CRC32 from "crc-32";

// I don't know who Zoltan is, but thank you.

interface PngChunk {
  type: string;
  data: Uint8Array;
  crc: number;
}

interface TextChunk {
  keyword: string;
  text: string;
}

export class Png {
  static uint8 = new Uint8Array(4);
  static int32 = new Int32Array(this.uint8.buffer);
  static uint32 = new Uint32Array(this.uint8.buffer);

  static decodeText(data: Uint8Array): TextChunk {
    let naming = true;
    let keyword = "";
    let text = "";

    for (let index = 0; index < data.length; index++) {
      const code = data[index];

      if (naming) {
        if (code) {
          keyword += String.fromCharCode(code);
        } else {
          naming = false;
        }
      } else {
        if (code) {
          text += String.fromCharCode(code);
        } else {
          throw new Error("Invalid NULL character found in PNG tEXt chunk");
        }
      }
    }

    return {
      keyword,
      text,
    };
  }

  static encodeText(keyword: string, text: string): Uint8Array {
    keyword = String(keyword);
    text = String(text);

    if (!/^[\x00-\xFF]+$/.test(keyword) || !/^[\x00-\xFF]+$/.test(text))
      throw new Error("Invalid character in PNG tEXt chunk");
    if (keyword.length > 79)
      throw new Error(
        'Keyword "' + keyword + '" is longer than the 79 character limit'
      );

    const data = new Uint8Array(keyword.length + text.length + 1);
    let idx = 0;
    let code;

    for (let i = 0; i < keyword.length; i++) {
      if (!(code = keyword.charCodeAt(i)))
        throw new Error("0x00 character is not permitted in tEXt keywords");
      data[idx++] = code;
    }

    data[idx++] = 0;

    for (let i = 0; i < text.length; i++) {
      if (!(code = text.charCodeAt(i)))
        throw new Error("0x00 character is not permitted in tEXt text");
      data[idx++] = code;
    }

    return data;
  }

  static readChunk(data: Uint8Array, idx: number): PngChunk {
    this.uint8[3] = data[idx++];
    this.uint8[2] = data[idx++];
    this.uint8[1] = data[idx++];
    this.uint8[0] = data[idx++];
    const length = this.uint32[0];

    const chunkType =
      String.fromCharCode(data[idx++]) +
      String.fromCharCode(data[idx++]) +
      String.fromCharCode(data[idx++]) +
      String.fromCharCode(data[idx++]);

    const chunkData = data.slice(idx, idx + length);
    idx += length;

    this.uint8[3] = data[idx++];
    this.uint8[2] = data[idx++];
    this.uint8[1] = data[idx++];
    this.uint8[0] = data[idx++];
    const crc = this.int32[0];

    if (crc !== CRC32.buf(chunkData, CRC32.str(chunkType)))
      throw new Error(
        'CRC for "' +
          chunkType +
          '" header is invalid, file is likely corrupted'
      );

    return {
      type: chunkType,
      data: chunkData,
      crc,
    };
  }

  static readChunks(data: Uint8Array): PngChunk[] {
    if (
      data[0] !== 0x89 ||
      data[1] !== 0x50 ||
      data[2] !== 0x4e ||
      data[3] !== 0x47 ||
      data[4] !== 0x0d ||
      data[5] !== 0x0a ||
      data[6] !== 0x1a ||
      data[7] !== 0x0a
    )
      throw new Error("Invalid PNG header");

    const chunks: PngChunk[] = [];

    let idx = 8;
    while (idx < data.length) {
      const chunk = Png.readChunk(data, idx);

      if (!chunks.length && chunk.type !== "IHDR")
        throw new Error("PNG missing IHDR header");

      chunks.push(chunk);
      idx += 4 + 4 + chunk.data.length + 4;
    }

    if (chunks.length === 0)
      throw new Error("PNG ended prematurely, no chunks");
    if (chunks[chunks.length - 1].type !== "IEND")
      throw new Error("PNG ended prematurely, missing IEND header");

    return chunks;
  }

  static encodeChunks(chunks: PngChunk[]): Uint8Array {
    const output = new Uint8Array(
      chunks.reduce(
        (a: number, c: PngChunk) => a + 4 + 4 + c.data.length + 4,
        8
      )
    );

    output[0] = 0x89;
    output[1] = 0x50;
    output[2] = 0x4e;
    output[3] = 0x47;
    output[4] = 0x0d;
    output[5] = 0x0a;
    output[6] = 0x1a;
    output[7] = 0x0a;

    let idx = 8;

    chunks.forEach((c: PngChunk) => {
      this.uint32[0] = c.data.length;
      output[idx++] = this.uint8[3];
      output[idx++] = this.uint8[2];
      output[idx++] = this.uint8[1];
      output[idx++] = this.uint8[0];

      output[idx++] = c.type.charCodeAt(0);
      output[idx++] = c.type.charCodeAt(1);
      output[idx++] = c.type.charCodeAt(2);
      output[idx++] = c.type.charCodeAt(3);

      for (let i = 0; i < c.data.length; ) {
        output[idx++] = c.data[i++];
      }

      this.int32[0] = c.crc || CRC32.buf(c.data, CRC32.str(c.type));
      output[idx++] = this.uint8[3];
      output[idx++] = this.uint8[2];
      output[idx++] = this.uint8[1];
      output[idx++] = this.uint8[0];
    });

    return output;
  }

  static Parse(arrayBuffer: ArrayBuffer): string {
    const chunks = Png.readChunks(new Uint8Array(arrayBuffer));

    const text = chunks
      .filter((c) => c.type === "tEXt")
      .map((c) => Png.decodeText(c.data));
    if (text.length < 1) throw new Error("No PNG text fields found in file");

    const chara = text.find((t) => t.keyword === "chara");
    if (chara === undefined)
      throw new Error('No PNG text field named "chara" found in file');

    try {
      return new TextDecoder().decode(
        Uint8Array.from(atob(chara.text), (c) => c.charCodeAt(0))
      );
    } catch (e) {
      throw new Error('Unable to parse "chara" field as base64');
    }
  }

  static Generate(arrayBuffer: ArrayBuffer, text: string): Uint8Array {
    const chunks = Png.readChunks(new Uint8Array(arrayBuffer)).filter(
      (c) => c.type !== "tEXt"
    );

    const textData = Png.encodeText(
      "chara",
      btoa(
        new TextEncoder()
          .encode(text)
          .reduce((a, c) => a + String.fromCharCode(c), "")
      )
    );

    chunks.splice(-1, 0, {
      type: "tEXt",
      data: textData,
      crc: CRC32.buf(textData, CRC32.str("tEXt")),
    });

    return Png.encodeChunks(chunks);
  }
}
