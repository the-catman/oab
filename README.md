# OAB

OAB stands for Object to ArrayBuffer. It's a library for serializing JavaScript objects into a ByteArray and back. It's meant to be efficient while providing solid error-catching.

## Storing

The `data` functions can read/write the following:

* Nulls
* Booleans
* Strings
* Arrays
* Objects (HashMaps/Dictionaries) 
* Integers (maximum of 32 bits)
* Floats (64-bit precision)

If a value is passed that does not match one of these data types, an error is thrown.

Note: objects and primitive datatypes must be stored and retrieved in the same order, otherwise either your data will be corrupted, or the program will throw an error.

Additionally, both the Lookup array and the `noUtf8` option must be the same on both the Writer and Reader.

## How does it compare to JSON?

Performance-wise, run [test.ts](./test.ts) and see the results, as they will differ from machine to machine.

In terms of functionality, it's nearly a drop-in replacement for JSON except for `undefined`. When passing `undefined`, the library will throw an error. The code is very easy to modify, though, so you can add that functionality (mapping `undefined` -> `null` in the Writer, as JSON does) if absolutely necessary.

## API Documentation

### Writer

```typescript
new Writer(options?: { lookup?: Lookup, initialCapacity?: number, noUtf8?: boolean })
```
**Constructor options:**
- `lookup` - The lookup
- `initialCapacity, defualt = 1024` - The buffer's initial capacity 
- `noUtf8: boolean, default = false` - Encode strings by the assumption that strings are only ASCII, which is faster.

Creates a new Writer instance for serializing data.

**Methods:**
- `i8/u8(num: number): Writer` - Write a signed/unsigned single byte respectively
- `i16/u16(num: number): Writer` - Write a signed/unsigned double byte respectively
- `i32/u32(num: number): Writer` - Write a signed/unsigned quad byte respectively
- `bytes(arr: number[] | Uint8Array | ArrayBuffer): Writer` - Write a byte array
- `vu(num: number): Writer` - Write unsigned variable-length integer
- `vi(num: number): Writer` - Write signed variable-length integer
- `string(str: string): Writer` - Write a UTF-8 encoded string
- `float(num: number): Writer` - Write a 64-bit float
- `data(value: OABDATA): Writer` - Serialize a value (auto-detects type)
- `out(): Uint8Array` - Returns the serialized binary data
- `reset(): Writer` - Clears the buffer for reuse

### Reader

```typescript
new Reader(buffer: Uint8Array, options?: { lookup?: Lookup, noUtf8: boolean })
```

**Constructor options:**
- `lookup` - The lookup
- `noUtf8, default = false` - Decode strings by the assumption that strings are only ASCII, which is faster.

Creates a new Reader instance for deserializing data.

**Methods:**
- `i8/u8(): number` - Read a signed/unsigned single byte respectively
- `i16/u16(): number` - Read a signed/unsigned double byte respectively
- `i32/u32(): number` - Read a signed/unsigned quad byte respectively
- `bytes(): Uint8Array` - Read a byte array
- `vu(): number` - Read unsigned variable-length integer
- `vi(): number` - Read signed variable-length integer
- `string(): string` - Read a UTF-8 encoded string
- `float(): number` - Read a 64-bit float
- `data(): OABDATA` - Deserialize a value (auto-detects type)
- `reset(buffer?: Uint8Array): Reader` - Resets read position (optionally with new buffer)

**Properties:**
- `at: number` - Current read position in buffer
- `lookup: Lookup` - Shared lookup table for key compression
- `buffer: Uint8Array` - The data buffer being read

### Types

```typescript
type Lookup = string[];
type OABDATA = number | boolean | OABDATA[] | { [key: string]: OABDATA } | null | string;
```

## Examples

### Basic Example

```typescript
let writer = new Writer();

writer.string("Hello!").vu(123).vi(-123).vi(456).float(5.4).float(-4.5).u8(234);

let reader = new Reader(writer.out());

console.log(reader.string(), reader.vu(), reader.vi(), reader.vi(),
    reader.float(), reader.float(), reader.u8()); // Hello! 123 -123 456 5.4 -4.5 234
```

### Basic Example 2

```typescript
let writer = new Writer();

writer.data([ 1, 2, 3, [ { hello: 123 }, "hello hello 1234" ] ]); // Warning in console: A key wasn't in the lookup table! "hello".

let reader = new Reader(writer.out());

console.log(reader.data()); // [ 1, 2, 3, [ { hello: 123 }, "hello hello 1234" ] ]
```

### Advanced Example

```typescript
const lookup = ["username"];

let writer = new Writer({ lookup });

writer.data([ { username: "cat" } ]);

let reader = new Reader(writer.out(), { lookup });

console.log(reader.data()); // [ { username: "cat" } ]
```
