const fs = require('fs');
const zlib = require('zlib');

// Manual CRC32 implementation
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type);
  const combined = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, combined, crcBuf]);
}

let raw = Buffer.alloc(0);
for (let y = 0; y < 192; y++) {
  raw = Buffer.concat([raw, Buffer.from([0])]);
  for (let x = 0; x < 192; x++) {
    const dist = Math.sqrt((x - 96) ** 2 + (y - 96) ** 2);
    raw = Buffer.concat([raw, dist <= 90 ? Buffer.from([255, 42, 122]) : Buffer.from([9, 9, 11])]);
  }
}

const sig = Buffer.from('89504e470d0a1a0a', 'hex');
const ihdr = makeChunk('IHDR', Buffer.from([0,0,0,192, 0,0,0,192, 8, 2, 0, 0, 0]));
const idat = makeChunk('IDAT', zlib.deflateSync(raw));
const iend = makeChunk('IEND', Buffer.alloc(0));

const png = Buffer.concat([sig, ihdr, idat, iend]);
fs.writeFileSync('./public/icon-192.png', png);
console.log('icon-192.png 생성 완료!');
