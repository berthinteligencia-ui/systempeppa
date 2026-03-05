const pdf = require("pdf-parse");
console.log("Type of pdf-parse:", typeof pdf);
console.log("Keys of pdf-parse:", Object.keys(pdf));
if (pdf.default) {
    console.log("Type of pdf-parse.default:", typeof pdf.default);
}

const fs = require("fs");
// Create a fake small pdf or just check if it throws on call
try {
    pdf(Buffer.from("")).then(() => { }).catch(() => { });
    console.log("Calling pdf() did not throw immediate sync error.");
} catch (e) {
    console.log("Calling pdf() threw:", e.message);
}
