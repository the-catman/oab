import { Reader, Writer } from "./index.ts";

// Example: basic storing and retrieving of primitive data types

let writer = new Writer();

writer.string("Hello!").vu(123).vi(-123).vi(456).float(5.4).float(-4.5).byte(234);

let reader = new Reader(writer.out());

console.log(reader.string(), reader.vu(), reader.vi(), reader.vi(),
    reader.float(), reader.float(), reader.byte()); // Hello! 123 -123 456 5.4 -4.5 234

// Example: basic storing and retrieving of objects

writer = new Writer();

writer.data([ 1, 2, 3, [ { hello: 123 }, "hello hello 1234" ] ]); // Warning in console: A key wasn't in the lookup table! "hello".

reader = new Reader(writer.out());

console.log(reader.data()); // [ 1, 2, 3, [ { hello: 123 }, "hello hello 1234" ] ]

// Example: advanced storing and retrieving of objects

const lookup = ["username"]; // Shared lookup between reader and writer containing the keys of any and all hashmaps.
// The idea is that this is shared only once between the client and server.

writer = new Writer({ lookup });

writer.data([ { username: "cat" } ]);

reader = new Reader(writer.out(), { lookup });

console.log(reader.data()); // [ { username: "cat" } ]