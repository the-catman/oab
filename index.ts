/** Lookup is shared between the receiver and the sender, and it's only use is for objects' keys.
When both the receiver and the sender share the lookup, we don't need to send the object key as a string.
Rather we can point out that both the receiver and the sender share it, so instead of a string,
we put a number which corresponds to the lookup. This saves a lot of space.
The lookup is simply an array of every single key in your object. Really useful especially for games, where keys don't change much.
*/
export type Lookup = string[];

export type OABDATA = number | boolean | OABDATA[] | { [key: string]: OABDATA } | null | string;

/**
 * For reading data from incoming packets.
 */
export class Reader {
    /** The index of the reader. */
    public at: number;

    /** The lookup. */
    public lookup: Lookup;

    /** The reader's buffer. */
    public buffer: Uint8Array;

    private convBuff = new ArrayBuffer(8);
    private u8 = new Uint8Array(this.convBuff);
    private f64 = new Float64Array(this.convBuff);

    constructor(content: Uint8Array, options?: {
        lookup?: Lookup
    }) {
        this.at = 0;
        this.buffer = content;
        this.lookup = options?.lookup || [];
    }

    /** Unsigned 8 bit integer. */
    public byte(): number {
        if (this.at >= this.buffer.length) throw new Error(`Out of bounds access!`);
        const val = this.buffer[this.at++];
        return val;
    }

    /** LEB128, variable length decoding of an unsigned integer. */
    public vu(): number {
        let out = 0, shift = 0;

        do {
            out |= (this.buffer[this.at] & 127) << shift;
            shift += 7;
        } while (this.byte() & 128);

        return out;
    }

    /** Variable length decoding of a signed integer. */
    public vi(): number {
        const data = this.vu();
        return data & 1 ? ~(data >> 1) : (data >> 1);
    }

    /** Retrieves a string with its length stored in the front. */
    public string(): string {
        const strLen = this.vu();
        if ((this.at + strLen) > this.buffer.length) throw new Error(`Out of bounds access!`);

        let final = "";
        for (let i = 0; i < strLen; i++) {
            const byte = this.buffer[this.at++];
            switch (true) {
                case (byte <= 0x7F):
                    final += String.fromCodePoint(byte);
                    break;
                case ((byte & 0b11100000) === 0b11000000):
                    final += String.fromCodePoint(((byte & 0b00011111) << 6) | (this.buffer[this.at++] & 0b00111111));
                    break;
                case ((byte & 0b11100000) === 0b11100000):
                    final += String.fromCodePoint(((byte & 0b00001111) << 12) | ((this.buffer[this.at++] & 0b00111111) << 6) |
                        (this.buffer[this.at++] & 0b00111111));
                    break;
                case ((byte & 0b11110000) === 0b11110000):
                    final += String.fromCodePoint(((byte & 0b00000111) << 18) | ((this.buffer[this.at++] & 0b00111111) << 12) |
                        ((this.buffer[this.at++] & 0b00111111) << 6) | (this.buffer[this.at++] & 0b00111111));
                    break;
                default:
                    throw new Error("Invalid UTF-8 sequence.");
            }
        }
        return final;
    }

    /** Retrieves integers/floats using 64 bit precision. */
    public float(): number {
        if ((this.at + 8) > this.buffer.length) throw new Error(`Tried setting at out of bounds! at=${this.at}`);
        this.u8[0] = this.buffer[this.at++];
        this.u8[1] = this.buffer[this.at++];
        this.u8[2] = this.buffer[this.at++];
        this.u8[3] = this.buffer[this.at++];
        this.u8[4] = this.buffer[this.at++];
        this.u8[5] = this.buffer[this.at++];
        this.u8[6] = this.buffer[this.at++];
        this.u8[7] = this.buffer[this.at++];
        return this.f64[0];
    }

    /** Retrieves many values, and can even do it recursively. */
    public data(): OABDATA {
        const header = this.buffer[this.at++];
        switch (header) {
            case 1: // Positive numbers
                return this.vu();

            case 2: // Negative numbers
                return -this.vu();

            case 3: // Floats
                return this.float();

            case 4: // True
                return true;

            case 5: // False
                return false;

            case 6: { // Array
                const arr: OABDATA = [],
                    length = this.vu();
                for (let i = 0; i < length; i++) {
                    arr.push(this.data());
                }
                return arr;
            }

            case 7: { // Any object
                const final: {
                    [key: string]: OABDATA
                } = {},
                    length = this.vu();
                for (let i = 0; i < length; i++) {
                    let key: string;
                    const byte = this.buffer[this.at++];
                    switch (byte) {
                        case 1: {
                            key = this.string();
                            break;
                        }
                        case 2: {
                            key = this.lookup[this.vu()];
                            if (key === undefined) { // Something has gone terribly wrong.
                                throw new Error(`Reader.getData's object key string looked up a value out of bounds!`);
                            }
                            break;
                        }
                        default:
                            throw new Error(`Unknown byte ${byte} in decoding an object.`);
                    }
                    final[key] = this.data();
                }
                return final;
            }

            case 8: // Null
                return null;

            case 9: // Length-based string
                return this.string();

            default: // Something has gone terribly wrong.
                throw new Error(`Unexpected index! Got ${header}`);
        }
    }

    /** Get the rest of the reader data after this.at.
     * 
     * Uses `Uint8Array.prototype.subarray`
    */
    public rest(): Uint8Array {
        return this.buffer.subarray(this.at, this.buffer.length);
    }
}

/** For writing data to outgoing packets. */
export class Writer {
    /** The lookup. */
    public lookup: { [key: string]: number };

    /** The buffer itself. */
    public buffer: number[];

    private convBuff = new ArrayBuffer(8);
    private u8 = new Uint8Array(this.convBuff);
    private f64 = new Float64Array(this.convBuff);

    constructor(options?: {
        lookup?: Lookup,
        warnIfNoLookup?: boolean
    }) {
        this.lookup = {};
        if (options?.lookup) {
            for (let i = 0; i < options.lookup.length; i++) {
                this.lookup[options.lookup[i]] = i;
            }
        }

        this.buffer = [];
    }

    /** Stores a single byte. */
    public byte(num: number) {
        this.buffer.push(num);
        return this;
    }

    /** LEB128, variable length encoding of an unsigned integer.
     * 
     * All integers will be cast to unsigned 32 bit integers, then stored.
     */
    public vu(num: number) {
        num >>>= 0; // Cast to unsigned 32 bits.

        do {
            let part = num & 0b01111111;
            num >>>= 7;
            if (num) part |= 0b10000000;
            this.buffer.push(part);
        } while (num);

        return this;
    }

    /** Variable length encoding of a signed integer.
     *  
     * Stores the sign in a single bit.
     */
    public vi(num: number) {
        return this.vu(num < 0 ? (~num << 1 | 1) : (num << 1));
    }

    /** Stores the length of the string instead of putting a null byte at the end,
     * since the string with null termination obviously can't store null characters.
     */
    public string(str: string) {
        this.vu(str.length);
        for (let i = 0; i < str.length; i++) {
            const charCode = str.codePointAt(i) as number;

            switch (true) {
                case (charCode <= 0x7F):
                    this.buffer.push(charCode);
                    break;
                case (charCode <= 0x7FF):
                    this.buffer.push(0b11000000 | (charCode >> 6));
                    this.buffer.push(0b10000000 | (charCode & 0b111111));
                    break;
                case (charCode <= 0xFFFF):
                    this.buffer.push(0b11100000 | (charCode >> 12));
                    this.buffer.push(0b10000000 | ((charCode >> 6) & 0b111111));
                    this.buffer.push(0b10000000 | (charCode & 0b111111));
                    break;
                case (charCode <= 0x10FFFF):
                    this.buffer.push(0b11110000 | (charCode >> 18));
                    this.buffer.push(0b10000000 | ((charCode >> 12) & 0b111111));
                    this.buffer.push(0b10000000 | ((charCode >> 6) & 0b111111));
                    this.buffer.push(0b10000000 | (charCode & 0b111111));
                    break;
                default:
                    throw new Error("Error in encoding in UTF-8: value out of bounds.");
            }
        }
        return this;
    }

    /** Stores an integer/float using 64 bit precision. */
    public float(num: number) {
        this.f64[0] = num;
        this.buffer.push(this.u8[0]);
        this.buffer.push(this.u8[1]);
        this.buffer.push(this.u8[2]);
        this.buffer.push(this.u8[3]);
        this.buffer.push(this.u8[4]);
        this.buffer.push(this.u8[5]);
        this.buffer.push(this.u8[6]);
        this.buffer.push(this.u8[7]);
        return this;
    }

    /** Stores many values, and can even do it recursively. */
    public data(data: OABDATA) {
        switch (typeof data) {
            case "number": { // Any "number"
                if (Number.isFinite(data)) { // Integer/Float
                    if (Number.isInteger(data)) { // Integer
                        if (data >= 0) {
                            this.buffer.push(1); // Positive int
                            this.vu(data);
                        } else {
                            this.buffer.push(2); // Negative int
                            this.vu(-data);
                        }
                    } else {
                        this.buffer.push(3); // Float
                        this.float(data);
                    }
                } else { // NaN, Infinity, etc
                    throw new Error(`Cannot store ${data}!`);
                }
                break;
            }
            case "boolean": { // Boolean
                this.buffer.push(
                    data ?
                        4 : // True
                        5 // False
                );
                break;
            }
            case "object": { // Any object
                if (Array.isArray(data)) { // Array
                    this.buffer.push(6);
                    this.vu(data.length);

                    for (let i = 0; i < data.length; i++)
                        this.data(data[i]);

                } else if (data !== null) {  // Any type of object other than null
                    const keys = Object.keys(data);
                    this.buffer.push(7);
                    this.vu(keys.length);

                    for (const key of keys) {
                        const value = data[key];
                        const tableEnc = this.lookup[key];

                        if (tableEnc === undefined) { // Not found key
                            this.buffer.push(1);
                            this.string(key); // Store it as a string
                            // console.warn(`A key wasn't in the lookup table! ${value}.`);
                        } else { // Key found
                            this.buffer.push(2);
                            this.vu(tableEnc); // Store the index
                        }

                        this.data(value); // Store the value
                    }
                } else {
                    this.buffer.push(8); // Null is an object
                }
                break;
            }

            case "string": // String
                this.buffer.push(9);
                this.string(data);
                break;

            default: // If none of these criteria are met, throw an error
                throw new Error(`Unknown data type! ${typeof (data)}`);
        }
        return this;
    }

    /** Get a Uint8Array of everything you wrote. */
    public out(): Uint8Array {
        return new Uint8Array(this.buffer);
    }
}
