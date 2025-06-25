# OAB

OAB stands for Object to ArrayBuffer.

## Updates

* `v1.0.0`: Library re-released.
* `v1.0.1`: Library now uses double precision.

## Usage

Copy [index.ts](./index.ts) into your project and import it.

Example:

```ts
import { Reader, Writer } from "./index.ts";

// Example: basic storing and retrieving of primitive data types

let writer = new Writer();

writer.string("Hello!").vu(123).vi(-123).vi(456).float(5.4).float(-4.5).byte(234);

let reader = new Reader(writer.out());

console.log(reader.string(), reader.vu(), reader.vi(), reader.vi(),
    reader.float(), reader.float(), reader.byte()); // Hello! 123 -123 456 5.4 -4.5 234

// Example: basic storing and retrieving of objects

writer = new Writer();

writer.data([1, 2, 3, [{ hello: 123 }, "hello hello 1234"]]);

reader = new Reader(writer.out());

console.log(reader.data()); // [ 1, 2, 3, [ { hello: 123 }, "hello hello 1234" ] ]
```

Note: objects and primitive datatypes must be stored and retrieved in the same order, otherwise either your data will be corrupted, or the program will throw an error.

Similarly, the Lookup array must be the same on both the Writer and Reader.

## Storing

This library can store the following:

* Nulls
* Booleans
* Strings
* Arrays
* Objects (HashMaps/Dictionaries) 
* Integers (maximum of 32 bits)
* Floats (double precision)

If a value is passed that does not match one of these data types, an error is thrown.

## Q&A

### What is this library?

This is a library for serializing JavaScript objects into a ByteArray and back.

### How does it compare to JSON?

Run [test.ts](./test.ts) and see the results.

It's around 3x slower than V8's implementation of JSON (JSON.stringify/.parse), which shouldn't come as too much of a shock given that V8's JSON is probably written in C++

JSON is widely supported, and human-readable, however it's not a binary serialization format, unlike my library.

### Is it reliable?

I have tested this, and it most likely is reliable. If you do find an edge case that breaks this, please, by all means, open up a ticket. I'll try and solve the issue ASAP.