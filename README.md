# OAB

OAB stands for Object to ArrayBuffer. It's a library for serializing JavaScript objects into a ByteArray and back. It's meant to be efficient while providing solid error-catching. It is almost but not completely compatible with JSON.

I have tested this, and have found it to be reliable. If you find an edge case that breaks this, open up a ticket.

## Updates

* `v1.0.0`: Library re-released.
* `v1.0.1`: Library now uses double precision.

## Storing

This library can store the following:

* Nulls
* Booleans
* Strings
* Arrays
* Objects (HashMaps/Dictionaries) 
* Integers (maximum of 32 bits)
* Floats (double precision)

If a value is passed that does not match one of these data types, an error is thrown (including `undefined`).

Note: objects and primitive datatypes must be stored and retrieved in the same order, otherwise either your data will be corrupted, or the program will throw an error.

Similarly, the Lookup array must be the same on both the Writer and Reader.

## How does it compare to JSON?

Run [test.ts](./test.ts) and see the results.

On my machine running [deno](https://deno.com/), it's around 3x slower than JSON (JSON.stringify/.parse), which shouldn't come as too much of a shock given that JSON is probably written in C++.

JSON is widely supported, and human-readable, however it's not a binary serialization format (unlike my library) which means that my library can achieve more compact packets.