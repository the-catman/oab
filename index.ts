/*
INFO: Lookup is shared between the receiver and the sender, and its only use is for objects' keys.
When both the receiver and the sender share the lookup, we don't need to send the object key as a string.
Rather we can point out that both the receiver and the sender share it, so instead of a string, we put a number which corresponds 
to the lookup. This saves a lot of space. The lookup is simply an array of every single key in your object.
Really useful especially for games, where keys don't change much.
*/

export type Lookup = string[];
export type OABDATA = number | boolean | OABDATA[] | { [key: string]: OABDATA } | null | string;

export class Reader {
    public at: number;
    public lookup: Lookup;
    public buffer: Uint8Array;
    public noUtf8: boolean;

    private view: DataView;

    constructor(content: Uint8Array, options?: {
        lookup?: Lookup,
        noUtf8?: boolean
    }) {
        this.at = 0;
        this.buffer = content;
        this.lookup = options?.lookup || [];
        this.view = new DataView(content.buffer, content.byteOffset, content.byteLength);
        this.noUtf8 = options?.noUtf8 || false;
    }

    public u8(): number {
        if (this.at >= this.buffer.length) throw new Error("Out of bounds access!");
        return this.buffer[this.at++];
    }

    public u16(): number {
        if (this.at + 2 > this.buffer.length) throw new Error("Out of bounds access!");
        const value = this.view.getUint16(this.at, true);
        this.at += 2;
        return value;
    }

    public u32(): number {
        if (this.at + 4 > this.buffer.length) throw new Error("Out of bounds access!");
        const value = this.view.getUint32(this.at, true);
        this.at += 4;
        return value;
    }

    public i8(): number {
        if (this.at >= this.buffer.length) throw new Error("Out of bounds access!");
        return this.view.getInt8(this.at++);
    }

    public i16(): number {
        if (this.at + 2 > this.buffer.length) throw new Error("Out of bounds access!");
        const value = this.view.getInt16(this.at, true);
        this.at += 2;
        return value;
    }

    public i32(): number {
        if (this.at + 4 > this.buffer.length) throw new Error("Out of bounds access!");
        const value = this.view.getInt32(this.at, true);
        this.at += 4;
        return value;
    }

    public bytes(): Uint8Array {
        const len = this.vu();
        if ((this.at + len) > this.buffer.length) throw new Error("Out of bounds access!");
        const result = this.buffer.slice(this.at, this.at + len);
        this.at += len;
        return result;
    }

    public vu(): number {
        let out = 0, shift = 0, b = 0;

        do {
            b = this.u8();
            out |= (b & 127) << shift;
            shift += 7;
        } while (b & 128);
        return out;
    }

    public vi(): number {
        const data = this.vu();
        return data & 1 ? ~(data >> 1) : (data >> 1);
    }

    public string(): string {
        if(this.noUtf8) {
            const byteLen = this.vu();
            if ((this.at + byteLen) > this.buffer.length) throw new Error("Out of bounds access!");
            let final = "";
            for(let i = 0; i < byteLen; i++) {
                final += String.fromCharCode(this.buffer[this.at++]);
            }
            return final;
        }

        const byteLen = this.vu();
        if ((this.at + byteLen) > this.buffer.length) throw new Error("Out of bounds access!");

        let final = "";
        const end = this.at + byteLen;

        while (this.at < end) {
            const byte = this.buffer[this.at++];
            if (byte <= 0x7F) {
                final += String.fromCharCode(byte);
            } else if ((byte & 0xE0) === 0xC0) {
                final += String.fromCharCode(((byte & 0x1F) << 6) | (this.buffer[this.at++] & 0x3F));
            } else if ((byte & 0xF0) === 0xE0) {
                final += String.fromCharCode(((byte & 0x0F) << 12) | ((this.buffer[this.at++] & 0x3F) << 6) |
                    (this.buffer[this.at++] & 0x3F));
            } else if ((byte & 0xF8) === 0xF0) {
                const codePoint = ((byte & 0x07) << 18) | ((this.buffer[this.at++] & 0x3F) << 12) |
                    ((this.buffer[this.at++] & 0x3F) << 6) | (this.buffer[this.at++] & 0x3F);
                final += String.fromCodePoint(codePoint);
            } else {
                throw new Error("Invalid UTF-8 sequence.");
            }
        }
        return final;
    }

    public float(): number {
        if (this.at + 8 > this.buffer.length) throw new Error("Out of bounds access!");
        const value = this.view.getFloat64(this.at, true);
        this.at += 8;
        return value;
    }

    public data(): OABDATA {
        const header = this.u8();
        switch (header) {
            case 1:
                return true;
            case 2:
                return false;
            case 3:
                return null;
            case 4:
                return this.vu();
            case 5:
                return -this.vu();
            case 6:
                return this.float();
            case 7:
                return this.string();
            case 8: {
                const length = this.vu();
                const arr: OABDATA[] = new Array(length);
                for (let i = 0; i < length; i++) {
                    arr[i] = this.data();
                }
                return arr;
            }
            case 9: {
                const length = this.vu();
                const final: { [key: string]: OABDATA } = {};

                for (let i = 0; i < length; i++) {
                    const byte = this.buffer[this.at++];
                    let key: string;

                    if (byte === 1) {
                        key = this.string();
                    } else if (byte === 2) {
                        const idx = this.vu();
                        key = this.lookup[idx];
                        if (key === undefined)
                            throw new Error(`Reader.getData's object key string looked up a value out of bounds!`);
                    } else {
                        throw new Error(`Unknown byte ${byte} in decoding an object.`);
                    }

                    final[key] = this.data();
                }
                return final;
            }

            default:
                throw new Error(`Unknown data header correspondance! Got header ${header}, which doesn't correspond to any data type.`);
        }
    }

    public reset(content: Uint8Array = this.buffer): Reader {
        this.at = 0;
        this.buffer = content;
        this.view = new DataView(content.buffer, content.byteOffset, content.byteLength);
        return this;
    }
}

export class Writer {
    public lookup: { [key: string]: number };
    public buffer: Uint8Array;
    public at: number;
    public noUtf8: boolean;

    private view: DataView;

    constructor(options?: {
        lookup?: Lookup,
        initialCapacity?: number,
        noUtf8?: boolean
    }) {
        this.lookup = {};
        if (options?.lookup) {
            for (let i = 0; i < options.lookup.length; i++) {
                this.lookup[options.lookup[i]] = i;
            }
        }

        this.buffer = new Uint8Array(options?.initialCapacity || 1024);
        this.at = 0;

        this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
        this.noUtf8 = options?.noUtf8 || false;
    }

    private ensureCapacity(additional: number): void {
        const needed = this.at + additional;
        if (needed > this.buffer.length) {
            const newBuffer = new Uint8Array(Math.max(this.buffer.length * 2, needed));
            newBuffer.set(this.buffer);
            this.buffer = newBuffer;
            this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
        }
    }

    public u8(num: number): Writer {
        this.ensureCapacity(1);
        this.buffer[this.at++] = num;
        return this;
    }

    public u16(num: number): Writer {
        this.ensureCapacity(2);
        this.view.setUint16(this.at, num, true);
        this.at += 2;
        return this;
    }

    public u32(num: number): Writer {
        this.ensureCapacity(4);
        this.view.setUint32(this.at, num, true);
        this.at += 4;
        return this;
    }

    /* No difference between i8 and u8, but it's here for API consistency. */
    public i8(num: number): Writer {
        this.ensureCapacity(1);
        this.buffer[this.at++] = num;
        return this;
    }

    public i16(num: number): Writer {
        this.ensureCapacity(2);
        this.view.setInt16(this.at, num, true);
        this.at += 2;
        return this;
    }

    public i32(num: number): Writer {
        this.ensureCapacity(4);
        this.view.setInt32(this.at, num, true);
        this.at += 4;
        return this;
    }

    public bytes(arr: number[] | Uint8Array | ArrayBuffer): Writer {
        const uint8 = arr instanceof Uint8Array ? arr : new Uint8Array(arr);
        const len = uint8.length;

        this.vu(len);

        this.ensureCapacity(len);
        this.buffer.set(uint8, this.at);
        this.at += len;

        return this;
    }

    public vu(num: number): Writer {
        num >>>= 0;
        this.ensureCapacity(5);

        do {
            let part = num & 0x7F;
            num >>>= 7;
            if (num) part |= 0x80;
            this.buffer[this.at++] = part;
        } while (num);

        return this;
    }

    public vi(num: number): Writer {
        return this.vu(num < 0 ? (~(num << 1)) : (num << 1));
    }

    public string(str: string): Writer {
        // Looks ugly but it's faster than most UTF-8 implementations.
        if(this.noUtf8) {
            const byteLen = str.length;
            this.vu(byteLen);
            this.ensureCapacity(byteLen);
            for(let i = 0; i < str.length; i++) {
                this.buffer[this.at++] = str.charCodeAt(i) & 0xFF;
            }
            return this;
        }

        let byteLen = 0;

        for (let i = 0; i < str.length; i++) {
            const code = str.charCodeAt(i);
            if (code <= 0x7F) {
                byteLen += 1;
            } else if (code <= 0x7FF) {
                byteLen += 2;
            } else if (code >= 0xD800 && code <= 0xDFFF) {
                byteLen += 4;
                i++;
            } else {
                byteLen += 3;
            }
        }

        this.vu(byteLen);
        this.ensureCapacity(byteLen);

        for (let i = 0; i < str.length; i++) {
            const code = str.charCodeAt(i);

            if (code <= 0x7F) {
                this.buffer[this.at++] = code;
            } else if (code <= 0x7FF) {
                this.buffer[this.at++] = 0xC0 | (code >> 6);
                this.buffer[this.at++] = 0x80 | (code & 0x3F);
            } else if (code >= 0xD800 && code <= 0xDFFF) {
                const high = code;
                const low = str.charCodeAt(++i);
                const codePoint = 0x10000 + ((high & 0x3FF) << 10) + (low & 0x3FF);
                this.buffer[this.at++] = 0xF0 | (codePoint >> 18);
                this.buffer[this.at++] = 0x80 | ((codePoint >> 12) & 0x3F);
                this.buffer[this.at++] = 0x80 | ((codePoint >> 6) & 0x3F);
                this.buffer[this.at++] = 0x80 | (codePoint & 0x3F);
            } else {
                this.buffer[this.at++] = 0xE0 | (code >> 12);
                this.buffer[this.at++] = 0x80 | ((code >> 6) & 0x3F);
                this.buffer[this.at++] = 0x80 | (code & 0x3F);
            }
        }

        return this;
    }

    public float(num: number): Writer {
        this.ensureCapacity(8);
        this.view.setFloat64(this.at, num, true);
        this.at += 8;
        return this;
    }

    public data(data: OABDATA): Writer {
        switch (data) {
            case true:
                return this.u8(1);
            case false:
                return this.u8(2);
            // Uncomment the line below if you need support for undefined, but it's generally recommended to not use undefined.
            // case undefined:
            case null:
                return this.u8(3);
        }

        switch (typeof data) {
            case "number": {
                if (Number.isFinite(data)) {
                    if (Number.isInteger(data)) {
                        if (data >= 0) {
                            return this.u8(4).vu(data);
                        } else {
                            return this.u8(5).vu(-data);
                        }
                    } else {
                        return this.u8(6).float(data);
                    }
                } else { // NaN and Infinity.
                    throw new Error(`Cannot store ${data}!`);
                }
            }

            case "string":
                return this.u8(7).string(data);

            case "object": {
                if (Array.isArray(data)) {
                    const arr = data as OABDATA[];
                    this.u8(8).vu(arr.length);

                    for (let i = 0; i < arr.length; i++) {
                        this.data(arr[i]);
                    }
                } else {
                    const obj = data as { [key: string]: OABDATA };

                    let keyCount = Object.keys(obj).length;

                    this.u8(9).vu(keyCount);

                    for (const key in obj) {
                        if (!obj.hasOwnProperty(key)) continue;

                        const value = obj[key];
                        const tableEnc = this.lookup[key];

                        if (tableEnc === undefined) {
                            this.u8(1).string(key);
                        } else {
                            this.u8(2).vu(tableEnc);
                        }

                        this.data(value);
                    }
                }
                return this;
            }
        }

        // Unreachable in TS but reachable in JS.
        throw new Error(`Cannot store ${typeof data}, data: ${data}`);
    }

    public out(): Uint8Array {
        return this.buffer.slice(0, this.at);
    }

    public reset(): Writer {
        this.at = 0;
        return this;
    }
}