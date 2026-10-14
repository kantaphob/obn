import pcsclite from "@pokusew/pcsclite";

const thaiIdAid = Buffer.from("A000000054480001", "hex");
const textDecoder = new TextDecoder("windows-874");

type SmartCardReader = {
  SCARD_STATE_PRESENT: number;
  SCARD_STATE_EMPTY: number;
  SCARD_SHARE_SHARED: number;
  close(): void;
  connect(options: { share_mode: number }, callback: (error: Error | null, protocol: number) => void): void;
  transmit(command: Buffer, responseLength: number, protocol: number, callback: (error: Error | null, response: Buffer) => void): void;
  on(event: "error", listener: (error: Error) => void): void;
  on(event: "end", listener: () => void): void;
  on(event: "status", listener: (status: { state: number; atr?: Buffer }) => void): void;
};

export class SmartCardReadError extends Error {
  constructor(
    message: string,
    readonly status = 503,
  ) {
    super(message);
    this.name = "SmartCardReadError";
  }
}

function decodeCardText(bytes: Buffer) {
  return textDecoder.decode(bytes).replace(/\0/g, "").trim();
}

function splitCardName(value: string) {
  const parts = value.split("#").map((part) => part.trim());
  while (parts.length > 1 && !parts.at(-1)) parts.pop();
  const prefix = parts[0] ?? "";
  const first = parts[1] ?? "";
  const surname = parts.at(-1) ?? "";
  const middle = parts.slice(2, -1).filter(Boolean).join(" ");
  return {
    prefix,
    firstName: [first, middle].filter(Boolean).join(" "),
    lastName: surname,
  };
}

function transmitRaw(reader: SmartCardReader, protocol: number, command: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    reader.transmit(command, 258, protocol, (error, response) => {
      if (error) {
        reject(new SmartCardReadError("เชื่อมต่อกับบัตรไม่สำเร็จ", 502));
        return;
      }
      if (response.length < 2) {
        reject(new SmartCardReadError("บัตรตอบกลับไม่ครบถ้วน", 502));
        return;
      }
      resolve(response);
    });
  });
}

async function readBinary(reader: SmartCardReader, protocol: number, offset: number, length: number, atr?: Buffer) {
  const command = Buffer.from([
    0x80,
    0xb0,
    (offset >> 8) & 0xff,
    offset & 0xff,
    0x02,
    0x00,
    length === 256 ? 0x00 : length,
  ]);
  let response = await transmitRaw(reader, protocol, command);
  const p2 = atr?.[0] === 0x3b && atr?.[1] === 0x67 ? 0x01 : 0x00;
  for (let attempt = 0; response.at(-2) === 0x61 && attempt < 2; attempt += 1) {
    const available = response.at(-1) || 256;
    const getResponse = Buffer.from([0x00, 0xc0, 0x00, p2, available === 256 ? 0x00 : available]);
    response = await transmitRaw(reader, protocol, getResponse);
  }
  const sw1 = response.at(-2)!;
  const sw2 = response.at(-1)!;
  if (sw1 === 0x90 && sw2 === 0x00) return response.subarray(0, -2);
  if (sw1 === 0x62 && sw2 === 0x82) return response.subarray(0, -2);
  throw new SmartCardReadError("บัตรไม่รองรับคำสั่งอ่านข้อมูลนี้", 422);
}

async function transmit(reader: SmartCardReader, protocol: number, command: Buffer, atr?: Buffer) {
  let response = await transmitRaw(reader, protocol, command);
  const p2 = atr?.[0] === 0x3b && atr?.[1] === 0x67 ? 0x01 : 0x00;
  for (let attempt = 0; response.at(-2) === 0x61 && attempt < 2; attempt += 1) {
    const available = response.at(-1) || 256;
    response = await transmitRaw(
      reader,
      protocol,
      Buffer.from([0x00, 0xc0, 0x00, p2, available === 256 ? 0x00 : available]),
    );
  }
  if (response.at(-2) !== 0x90 || response.at(-1) !== 0x00) {
    throw new SmartCardReadError("เลือกข้อมูลบัตรประชาชนไม่สำเร็จ", 422);
  }
  return response.subarray(0, -2);
}

async function readCardData(reader: SmartCardReader, protocol: number, atr?: Buffer) {
  await transmit(
    reader,
    protocol,
    Buffer.concat([Buffer.from([0x00, 0xa4, 0x04, 0x00, thaiIdAid.length]), thaiIdAid]),
    atr,
  );

  const nationalId = await readBinary(reader, protocol, 0x0004, 13, atr);
  const nationalIdValue = decodeCardText(nationalId).replace(/\D/g, "");
  if (nationalIdValue.length !== 13) {
    throw new SmartCardReadError("บัตรไม่ส่งเลขประจำตัว 13 หลัก กรุณาถอดบัตรแล้วเสียบใหม่", 422);
  }
  const thaiNameBytes = await readBinary(reader, protocol, 0x0011, 100, atr);
  const englishNameBytes = await readBinary(reader, protocol, 0x0075, 100, atr);
  const birthDate = await readBinary(reader, protocol, 0x00d9, 8, atr);
  const addressBytes = await readBinary(reader, protocol, 0x1579, 100, atr);
  const issueDate = await readBinary(reader, protocol, 0x0167, 8, atr);
  const expiryDate = await readBinary(reader, protocol, 0x016f, 8, atr);
  const gender = await readBinary(reader, protocol, 0x00e1, 1, atr);

  const thaiName = splitCardName(decodeCardText(thaiNameBytes));
  const englishName = splitCardName(decodeCardText(englishNameBytes));
  const address = decodeCardText(addressBytes).split("#").filter(Boolean).join(" ");
  const houseNumber = address.match(/\d+[\d/.-]*/)?.[0] ?? "";
  const photoChunks: Buffer[] = [];
  try {
    for (let index = 0; index < 20; index += 1) {
      const offset = 0x017b + index * 0x00ff;
      photoChunks.push(await readBinary(reader, protocol, offset, 0xff, atr));
    }
  } catch {
    // Basic identity fields remain usable when the card does not expose a photo.
  }
  const photo = Buffer.concat(photoChunks);
  const hasJpegHeader = photo[0] === 0xff && photo[1] === 0xd8;

  const genderValue = decodeCardText(gender);
  if (!thaiName.firstName || !thaiName.lastName) {
    throw new SmartCardReadError("บัตรไม่ส่งข้อมูลประจำตัว กรุณาถอดบัตรแล้วเสียบใหม่", 422);
  }
  return {
    nationalId: nationalIdValue,
    prefixTH: thaiName.prefix,
    firstName: thaiName.firstName,
    lastName: thaiName.lastName,
    firstNameEN: englishName.firstName,
    lastNameEN: englishName.lastName,
    birthDate: decodeCardText(birthDate),
    address,
    houseNumber,
    issueDate: decodeCardText(issueDate),
    expiryDate: decodeCardText(expiryDate),
    gender: genderValue === "1" ? "ชาย" : genderValue === "2" ? "หญิง" : "",
    ...(hasJpegHeader ? { photoBase64: photo.toString("base64") } : {}),
  };
}

export function readThaiSmartCard() {
  return new Promise<Record<string, string>>((resolve, reject) => {
    const pcsc = pcsclite();
    let readerInstance: SmartCardReader | undefined;
    let settled = false;
    let reading = false;

    const cleanup = () => {
      clearTimeout(timeout);
      if (readerInstance) readerInstance.close();
      pcsc.close();
    };
    const finish = (error?: Error, data?: Record<string, string>) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(data ?? {});
    };
    const timeout = setTimeout(
      () => finish(new SmartCardReadError("ไม่พบเครื่องอ่านบัตรผ่าน PC/SC", 503)),
      5000,
    );

    pcsc.on("error", () => finish(new SmartCardReadError("เชื่อมต่อ PC/SC ไม่ได้", 503)));
    pcsc.on("reader", (reader) => {
      readerInstance = reader;
      reader.on("error", () => finish(new SmartCardReadError("เครื่องอ่านบัตรขัดข้อง", 503)));
      reader.on("end", () => finish(new SmartCardReadError("ไม่พบเครื่องอ่านบัตร", 503)));
      reader.on("status", (status) => {
        if (settled || reading) return;
        if (status.state & reader.SCARD_STATE_PRESENT) {
          reading = true;
          reader.connect({ share_mode: reader.SCARD_SHARE_SHARED }, (error, protocol) => {
            if (error) {
              finish(new SmartCardReadError("เชื่อมต่อกับบัตรไม่ได้ กรุณาตรวจสอบตำแหน่งบัตร", 503));
              return;
            }
            void readCardData(reader, protocol, status.atr).then(
              (data) => finish(undefined, data),
              (readError: Error) => finish(readError),
            );
          });
        } else if (status.state & reader.SCARD_STATE_EMPTY) {
          finish(new SmartCardReadError("ไม่พบบัตรในเครื่องอ่าน", 503));
        }
      });
    });
  });
}
