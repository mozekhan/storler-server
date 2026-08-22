// const crypto = require("crypto");
// const QRCode = require("qrcode");
// const { AppError } = require("../middleware/errorHandler");
// const Transaction = require("../models/Transaction");

// class QRService {
//   constructor() {
//     this.secretKey = this.getSecureKey(
//       process.env.QR_SECRET_KEY || "default-secret-key-change-in-production"
//     );
//     this.algorithm = "aes-256-gcm";
//     this.expirationHours = 24;
//   }

//   getSecureKey(input) {
//     return crypto.createHash('sha256').update(input).digest();
//   }

//   /**
//    * Generate compact payload - only essential data
//    */
//   generatePayload(data) {
//     // Only include essential fields, not the full transaction
//     const payload = {
//       v: "1.0",                    // version (short key)
//       t: data.type,                // type: S, P, R, I (shortened)
//       i: data.transactionId,       // transaction ID
//       s: data.storeId,             // store ID
//       st: data.step || data.type,  // step
//       ts: Date.now(),              // timestamp
//       e: Date.now() + this.expirationHours * 60 * 60 * 1000, // expires
//     };

//     // Add metadata only if not too large
//     if (data.metadata) {
//       // Only include essential metadata
//       const meta = {};
//       if (data.metadata.totalAmount) meta.a = Math.round(data.metadata.totalAmount * 100);
//       if (data.metadata.itemCount) meta.c = data.metadata.itemCount;
//       if (data.metadata.transactionNumber) meta.n = data.metadata.transactionNumber;
//       if (data.metadata.invoiceNumber) meta.in = data.metadata.invoiceNumber;
//       if (Object.keys(meta).length > 0) {
//         payload.m = meta;
//       }
//     }

//     // Generate HMAC
//     const hmac = crypto.createHmac("sha256", this.secretKey);
//     // Use a compact string for HMAC
//     const hmacData = `${payload.i}:${payload.t}:${payload.ts}:${payload.s}`;
//     hmac.update(hmacData);
//     payload.ch = hmac.digest("hex").substring(0, 16); // Shorten checksum

//     return payload;
//   }

//   async generateQR(data) {
//     try {
//       const payload = this.generatePayload(data);
//       const jsonString = JSON.stringify(payload);

//       // Check size - if too large, reduce further
//       if (jsonString.length > 3000) {
//         // Remove metadata if too large
//         delete payload.m;
//         const compactJson = JSON.stringify(payload);
//         if (compactJson.length > 3000) {
//           // Use shorter keys and compress
//           const minimal = {
//             v: payload.v,
//             t: payload.t,
//             i: payload.i,
//             s: payload.s,
//             ts: payload.ts,
//           };
//           const minimalJson = JSON.stringify(minimal);
//           return await this._generateQRCode(minimalJson);
//         }
//         return await this._generateQRCode(compactJson);
//       }

//       return await this._generateQRCode(jsonString);
//     } catch (error) {
//       console.error("QR Generation Error:", error);
//       throw new Error(`Failed to generate QR code: ${error.message}`);
//     }
//   }

//   /**
//    * Generate QR code from JSON string
//    */
//   async _generateQRCode(jsonString) {
//     // Use a simpler approach - store the data directly in the QR
//     // QR Code version 10 (size 57x57) can store ~1,823 characters
//     // Version 20 (size 97x97) can store ~3,353 characters
//     const qrOptions = {
//       errorCorrectionLevel: 'M',  // Medium error correction (less data overhead)
//       margin: 2,
//       width: 250,
//       // version: 10,  // Start with version 10, auto-increase if needed
//     };

//     try {
//       return await QRCode.toDataURL(jsonString, qrOptions);
//     } catch (error) {
//       // If data is too large, try with higher version
//       if (error.message.includes('too big')) {
//         qrOptions.version = 20;
//         return await QRCode.toDataURL(jsonString, qrOptions);
//       }
//       throw error;
//     }
//   }

//   /**
//    * Validate QR data - handles both compact and full formats
//    */
//   validateQR(qrData) {
//     try {
//       // Try to parse as JSON
//       let payload;
//       try {
//         payload = JSON.parse(qrData);
//       } catch (e) {
//         // Try base64 decode
//         try {
//           const decoded = Buffer.from(qrData, 'base64').toString('utf8');
//           payload = JSON.parse(decoded);
//         } catch (e2) {
//           return { valid: false, error: "Invalid QR code format" };
//         }
//       }

//       // Check if it's a compact payload (short keys)
//       const isCompact = payload.v !== undefined && payload.i !== undefined && payload.t !== undefined;

//       if (isCompact) {
//         return this._validateCompactPayload(payload);
//       }

//       // Legacy format - try to extract data
//       if (payload.transactionId) {
//         return this._validateLegacyPayload(payload);
//       }

//       return { valid: false, error: "Invalid QR code structure" };
//     } catch (error) {
//       console.error("QR Validation Error:", error);
//       return { valid: false, error: error.message };
//     }
//   }

//   /**
//    * Validate compact payload format
//    */
//   _validateCompactPayload(payload) {
//     // Check expiration
//     if (payload.e && Date.now() > payload.e) {
//       return { valid: false, error: "QR code expired" };
//     }

//     // Check timestamp
//     if (payload.ts) {
//       const age = Date.now() - payload.ts;
//       if (age > this.expirationHours * 60 * 60 * 1000) {
//         return { valid: false, error: "QR code expired" };
//       }
//     }

//     // Verify checksum (if present)
//     if (payload.ch) {
//       const hmac = crypto.createHmac("sha256", this.secretKey);
//       const hmacData = `${payload.i}:${payload.t}:${payload.ts}:${payload.s}`;
//       hmac.update(hmacData);
//       const expectedChecksum = hmac.digest("hex").substring(0, 16);
      
//       if (payload.ch !== expectedChecksum) {
//         return { valid: false, error: "Invalid QR checksum" };
//       }
//     }

//     // Map compact keys to full format
//     const typeMap = {
//       'S': 'SALES',
//       'P': 'PAYMENT',
//       'R': 'RELEASE',
//       'I': 'INVOICE'
//     };

//     return {
//       valid: true,
//       data: {
//         version: payload.v,
//         type: typeMap[payload.t] || payload.t,
//         transactionId: payload.i,
//         storeId: payload.s,
//         step: payload.st || payload.t,
//         timestamp: payload.ts,
//         expiresAt: payload.e,
//         metadata: payload.m ? {
//           totalAmount: payload.m.a ? payload.m.a / 100 : undefined,
//           itemCount: payload.m.c,
//           transactionNumber: payload.m.n,
//           invoiceNumber: payload.m.in,
//         } : {},
//       }
//     };
//   }

//   /**
//    * Validate legacy payload format
//    */
//   _validateLegacyPayload(payload) {
//     // Check expiration
//     if (payload.expiresAt && Date.now() > payload.expiresAt) {
//       return { valid: false, error: "QR code expired" };
//     }

//     if (payload.timestamp) {
//       const age = Date.now() - payload.timestamp;
//       if (age > this.expirationHours * 60 * 60 * 1000) {
//         return { valid: false, error: "QR code expired" };
//       }
//     }

//     // Verify checksum if present
//     if (payload.checksum) {
//       const hmac = crypto.createHmac("sha256", this.secretKey);
//       const { checksum, ...data } = payload;
//       const hmacData = `${data.type}:${data.transactionId}:${data.storeId}`;
//       hmac.update(hmacData);
//       if (hmac.digest("hex") !== checksum) {
//         return { valid: false, error: "Invalid QR checksum" };
//       }
//     }

//     return { valid: true, data: payload };
//   }

//   /**
//    * Validate and get transaction
//    */
//   async validateAndGetTransaction(qrData) {
//     const validation = this.validateQR(qrData);

//     if (!validation.valid) {
//       throw new AppError(validation.error || "Invalid QR code", 400);
//     }

//     const transaction = await Transaction.findById(validation.data.transactionId)
//       .populate("items.productId")
//       .populate("salesAttendantId", "firstName lastName")
//       .populate("financeAttendantId", "firstName lastName");

//     if (!transaction) {
//       throw new AppError("Transaction not found", 404);
//     }

//     return {
//       transaction,
//       qrType: validation.data.type,
//       step: validation.data.step,
//       metadata: validation.data.metadata,
//     };
//   }
// }

// module.exports = new QRService();






































// const crypto = require("crypto");
// const QRCode = require("qrcode");
// const { AppError } = require("../middleware/errorHandler");
// const Transaction = require("../models/Transaction");

// class QRService {
//   constructor() {
//     this.secretKey = this.getSecureKey(
//       process.env.QR_SECRET_KEY || "default-secret-key-change-in-production"
//     );
//     this.algorithm = "aes-256-gcm";
//     this.expirationHours = 24;
//   }

//   getSecureKey(input) {
//     return crypto.createHash('sha256').update(input).digest();
//   }

//   /**
//    * Generate compact payload - only essential data
//    */
//   generatePayload(data) {
//     // Only include essential fields, not the full transaction
//     const payload = {
//       v: "1.0",                    // version (short key)
//       t: data.type,                // type: S, P, R, I (shortened)
//       i: data.transactionId,       // transaction ID
//       s: data.storeId,             // store ID
//       st: data.step || data.type,  // step
//       ts: Date.now(),              // timestamp
//       e: Date.now() + this.expirationHours * 60 * 60 * 1000, // expires
//     };

//     // Add metadata only if not too large
//     if (data.metadata) {
//       // Only include essential metadata
//       const meta = {};
//       if (data.metadata.totalAmount) meta.a = Math.round(data.metadata.totalAmount * 100);
//       if (data.metadata.itemCount) meta.c = data.metadata.itemCount;
//       if (data.metadata.transactionNumber) meta.n = data.metadata.transactionNumber;
//       if (data.metadata.invoiceNumber) meta.in = data.metadata.invoiceNumber;
//       if (Object.keys(meta).length > 0) {
//         payload.m = meta;
//       }
//     }

//     // Generate HMAC
//     const hmac = crypto.createHmac("sha256", this.secretKey);
//     // Use a compact string for HMAC
//     const hmacData = `${payload.i}:${payload.t}:${payload.ts}:${payload.s}`;
//     hmac.update(hmacData);
//     payload.ch = hmac.digest("hex").substring(0, 16); // Shorten checksum

//     return payload;
//   }

//   /**
//    * Generates a QR code and returns BOTH representations of it:
//    *   - dataUrl:  rendered PNG (data:image/png;base64,...) for on-screen <Image> display
//    *   - qrString: the exact raw JSON string that was encoded into the image
//    *
//    * IMPORTANT: qrString is what validateQR() expects to receive back when
//    * scanned. Anything that needs to re-print or re-render this QR (e.g. a
//    * thermal printer, which needs the raw scannable payload rather than a
//    * rasterized picture-of-a-picture) MUST use qrString, never dataUrl.
//    */
//   async generateQR(data) {
//     try {
//       const payload = this.generatePayload(data);
//       let jsonString = JSON.stringify(payload);

//       // Check size - if too large, reduce further. The checksum ("ch") is
//       // always kept, even in the minimal fallback - dropping it would
//       // silently disable integrity verification for that QR, since
//       // validateQR() only checks the checksum when one is present.
//       if (jsonString.length > 3000) {
//         delete payload.m;
//         jsonString = JSON.stringify(payload);

//         if (jsonString.length > 3000) {
//           const minimal = {
//             v: payload.v,
//             t: payload.t,
//             i: payload.i,
//             s: payload.s,
//             ts: payload.ts,
//             e: payload.e,
//             ch: payload.ch,
//           };
//           jsonString = JSON.stringify(minimal);
//         }
//       }

//       const dataUrl = await this._generateQRCode(jsonString);

//       return { dataUrl, qrString: jsonString, payload };
//     } catch (error) {
//       console.error("QR Generation Error:", error);
//       throw new Error(`Failed to generate QR code: ${error.message}`);
//     }
//   }

//   /**
//    * Generate QR code from JSON string
//    */
//   async _generateQRCode(jsonString) {
//     // Use a simpler approach - store the data directly in the QR
//     // QR Code version 10 (size 57x57) can store ~1,823 characters
//     // Version 20 (size 97x97) can store ~3,353 characters
//     const qrOptions = {
//       errorCorrectionLevel: 'M',  // Medium error correction (less data overhead)
//       margin: 2,
//       width: 250,
//       // version: 10,  // Start with version 10, auto-increase if needed
//     };

//     try {
//       return await QRCode.toDataURL(jsonString, qrOptions);
//     } catch (error) {
//       // If data is too large, try with higher version
//       if (error.message.includes('too big')) {
//         qrOptions.version = 20;
//         return await QRCode.toDataURL(jsonString, qrOptions);
//       }
//       throw error;
//     }
//   }

//   /**
//    * Validate QR data - handles both compact and full formats
//    */
//   validateQR(qrData) {
//     try {
//       // Try to parse as JSON
//       let payload;
//       try {
//         payload = JSON.parse(qrData);
//       } catch (e) {
//         // Try base64 decode
//         try {
//           const decoded = Buffer.from(qrData, 'base64').toString('utf8');
//           payload = JSON.parse(decoded);
//         } catch (e2) {
//           return { valid: false, error: "Invalid QR code format" };
//         }
//       }

//       // Check if it's a compact payload (short keys)
//       const isCompact = payload.v !== undefined && payload.i !== undefined && payload.t !== undefined;

//       if (isCompact) {
//         return this._validateCompactPayload(payload);
//       }

//       // Legacy format - try to extract data
//       if (payload.transactionId) {
//         return this._validateLegacyPayload(payload);
//       }

//       return { valid: false, error: "Invalid QR code structure" };
//     } catch (error) {
//       console.error("QR Validation Error:", error);
//       return { valid: false, error: error.message };
//     }
//   }

//   /**
//    * Validate compact payload format
//    */
//   _validateCompactPayload(payload) {
//     // Check expiration
//     if (payload.e && Date.now() > payload.e) {
//       return { valid: false, error: "QR code expired" };
//     }

//     // Check timestamp
//     if (payload.ts) {
//       const age = Date.now() - payload.ts;
//       if (age > this.expirationHours * 60 * 60 * 1000) {
//         return { valid: false, error: "QR code expired" };
//       }
//     }

//     // Verify checksum (if present)
//     if (payload.ch) {
//       const hmac = crypto.createHmac("sha256", this.secretKey);
//       const hmacData = `${payload.i}:${payload.t}:${payload.ts}:${payload.s}`;
//       hmac.update(hmacData);
//       const expectedChecksum = hmac.digest("hex").substring(0, 16);
      
//       if (payload.ch !== expectedChecksum) {
//         return { valid: false, error: "Invalid QR checksum" };
//       }
//     }

//     // Map compact keys to full format
//     const typeMap = {
//       'S': 'SALES',
//       'P': 'PAYMENT',
//       'R': 'RELEASE',
//       'I': 'INVOICE'
//     };

//     return {
//       valid: true,
//       data: {
//         version: payload.v,
//         type: typeMap[payload.t] || payload.t,
//         transactionId: payload.i,
//         storeId: payload.s,
//         step: payload.st || payload.t,
//         timestamp: payload.ts,
//         expiresAt: payload.e,
//         metadata: payload.m ? {
//           totalAmount: payload.m.a ? payload.m.a / 100 : undefined,
//           itemCount: payload.m.c,
//           transactionNumber: payload.m.n,
//           invoiceNumber: payload.m.in,
//         } : {},
//       }
//     };
//   }

//   /**
//    * Validate legacy payload format
//    */
//   _validateLegacyPayload(payload) {
//     // Check expiration
//     if (payload.expiresAt && Date.now() > payload.expiresAt) {
//       return { valid: false, error: "QR code expired" };
//     }

//     if (payload.timestamp) {
//       const age = Date.now() - payload.timestamp;
//       if (age > this.expirationHours * 60 * 60 * 1000) {
//         return { valid: false, error: "QR code expired" };
//       }
//     }

//     // Verify checksum if present
//     if (payload.checksum) {
//       const hmac = crypto.createHmac("sha256", this.secretKey);
//       const { checksum, ...data } = payload;
//       const hmacData = `${data.type}:${data.transactionId}:${data.storeId}`;
//       hmac.update(hmacData);
//       if (hmac.digest("hex") !== checksum) {
//         return { valid: false, error: "Invalid QR checksum" };
//       }
//     }

//     return { valid: true, data: payload };
//   }

//   /**
//    * Best-effort decode of a QR string into its payload object, WITHOUT
//    * enforcing expiration or checksum. For display/audit purposes only
//    * (e.g. showing a human-readable snapshot on a Receipt record) - never
//    * use this in place of validateQR() to decide whether a scan is valid.
//    */
//   decodePayload(qrString) {
//     try {
//       return JSON.parse(qrString);
//     } catch (error) {
//       return null;
//     }
//   }

//   /**
//    * Validate and get transaction
//    */
//   async validateAndGetTransaction(qrData) {
//     const validation = this.validateQR(qrData);

//     if (!validation.valid) {
//       throw new AppError(validation.error || "Invalid QR code", 400);
//     }

//     const transaction = await Transaction.findById(validation.data.transactionId)
//       .populate("items.productId")
//       .populate("salesAttendantId", "firstName lastName")
//       .populate("financeAttendantId", "firstName lastName");

//     if (!transaction) {
//       throw new AppError("Transaction not found", 404);
//     }

//     return {
//       transaction,
//       qrType: validation.data.type,
//       step: validation.data.step,
//       metadata: validation.data.metadata,
//     };
//   }
// }

// module.exports = new QRService();















































// // services/qrService.js
// const crypto = require("crypto");
// const QRCode = require("qrcode");
// const { AppError } = require("../middleware/errorHandler");
// const Transaction = require("../models/Transaction");

// class QRService {
//   constructor() {
//     this.secretKey = this.getSecureKey(
//       process.env.QR_SECRET_KEY || "default-secret-key-change-in-production"
//     );
//     this.algorithm = "aes-256-gcm";
//     this.expirationHours = 24;
//   }

//   getSecureKey(input) {
//     return crypto.createHash('sha256').update(input).digest();
//   }

//   /**
//    * Generate compact payload - only essential data
//    */
//   generatePayload(data) {
//     const payload = {
//       v: "1.0",
//       t: data.type, // S, P, R, I
//       i: data.transactionId,
//       s: data.storeId,
//       st: data.step || data.type,
//       ts: Date.now(),
//       e: Date.now() + this.expirationHours * 60 * 60 * 1000,
//     };

//     // Add metadata only if not too large
//     if (data.metadata) {
//       const meta = {};
//       if (data.metadata.totalAmount) meta.a = Math.round(data.metadata.totalAmount * 100);
//       if (data.metadata.itemCount) meta.c = data.metadata.itemCount;
//       if (data.metadata.transactionNumber) meta.n = data.metadata.transactionNumber;
//       if (data.metadata.invoiceNumber) meta.in = data.metadata.invoiceNumber;
//       if (Object.keys(meta).length > 0) {
//         payload.m = meta;
//       }
//     }

//     // Generate HMAC checksum
//     const hmac = crypto.createHmac("sha256", this.secretKey);
//     const hmacData = `${payload.i}:${payload.t}:${payload.ts}:${payload.s}`;
//     hmac.update(hmacData);
//     payload.ch = hmac.digest("hex").substring(0, 16);

//     return payload;
//   }

//   /**
//    * Generates a QR code and returns BOTH representations:
//    *   - dataUrl:  rendered PNG (data:image/png;base64,...) for on-screen display
//    *   - qrString: the exact raw JSON string that was encoded into the image
//    *
//    * IMPORTANT: qrString is what validateQR() expects when scanned.
//    * Anything that needs to re-print or re-render this QR MUST use qrString.
//    */
//   async generateQR(data) {
//     try {
//       const payload = this.generatePayload(data);
//       let jsonString = JSON.stringify(payload);

//       // Check size - if too large, reduce further
//       if (jsonString.length > 3000) {
//         delete payload.m;
//         jsonString = JSON.stringify(payload);

//         if (jsonString.length > 3000) {
//           const minimal = {
//             v: payload.v,
//             t: payload.t,
//             i: payload.i,
//             s: payload.s,
//             ts: payload.ts,
//             e: payload.e,
//             ch: payload.ch,
//           };
//           jsonString = JSON.stringify(minimal);
//         }
//       }

//       const dataUrl = await this._generateQRCode(jsonString);

//       return { 
//         dataUrl,        // PNG image for display
//         qrString: jsonString, // Raw data for scanning
//         payload 
//       };
//     } catch (error) {
//       console.error("QR Generation Error:", error);
//       throw new Error(`Failed to generate QR code: ${error.message}`);
//     }
//   }

//   /**
//    * Generate QR code from JSON string
//    */
//   async _generateQRCode(jsonString) {
//     const qrOptions = {
//       errorCorrectionLevel: 'M',
//       margin: 2,
//       width: 250,
//     };

//     try {
//       return await QRCode.toDataURL(jsonString, qrOptions);
//     } catch (error) {
//       if (error.message.includes('too big')) {
//         qrOptions.version = 20;
//         return await QRCode.toDataURL(jsonString, qrOptions);
//       }
//       throw error;
//     }
//   }

//   /**
//    * Validate QR data - expects the raw string (qrString), not the data-URL
//    */
//   validateQR(qrData) {
//     try {
//       let payload;
//       try {
//         payload = JSON.parse(qrData);
//       } catch (e) {
//         try {
//           const decoded = Buffer.from(qrData, 'base64').toString('utf8');
//           payload = JSON.parse(decoded);
//         } catch (e2) {
//           return { valid: false, error: "Invalid QR code format" };
//         }
//       }

//       const isCompact = payload.v !== undefined && payload.i !== undefined && payload.t !== undefined;

//       if (isCompact) {
//         return this._validateCompactPayload(payload);
//       }

//       if (payload.transactionId) {
//         return this._validateLegacyPayload(payload);
//       }

//       return { valid: false, error: "Invalid QR code structure" };
//     } catch (error) {
//       console.error("QR Validation Error:", error);
//       return { valid: false, error: error.message };
//     }
//   }

//   /**
//    * Validate compact payload format
//    */
//   _validateCompactPayload(payload) {
//     if (payload.e && Date.now() > payload.e) {
//       return { valid: false, error: "QR code expired" };
//     }

//     if (payload.ts) {
//       const age = Date.now() - payload.ts;
//       if (age > this.expirationHours * 60 * 60 * 1000) {
//         return { valid: false, error: "QR code expired" };
//       }
//     }

//     if (payload.ch) {
//       const hmac = crypto.createHmac("sha256", this.secretKey);
//       const hmacData = `${payload.i}:${payload.t}:${payload.ts}:${payload.s}`;
//       hmac.update(hmacData);
//       const expectedChecksum = hmac.digest("hex").substring(0, 16);
      
//       if (payload.ch !== expectedChecksum) {
//         return { valid: false, error: "Invalid QR checksum" };
//       }
//     }

//     const typeMap = {
//       'S': 'SALES',
//       'P': 'PAYMENT',
//       'R': 'RELEASE',
//       'I': 'INVOICE'
//     };

//     return {
//       valid: true,
//       data: {
//         version: payload.v,
//         type: typeMap[payload.t] || payload.t,
//         transactionId: payload.i,
//         storeId: payload.s,
//         step: payload.st || payload.t,
//         timestamp: payload.ts,
//         expiresAt: payload.e,
//         metadata: payload.m ? {
//           totalAmount: payload.m.a ? payload.m.a / 100 : undefined,
//           itemCount: payload.m.c,
//           transactionNumber: payload.m.n,
//           invoiceNumber: payload.m.in,
//         } : {},
//       }
//     };
//   }

//   /**
//    * Validate legacy payload format
//    */
//   _validateLegacyPayload(payload) {
//     if (payload.expiresAt && Date.now() > payload.expiresAt) {
//       return { valid: false, error: "QR code expired" };
//     }

//     if (payload.timestamp) {
//       const age = Date.now() - payload.timestamp;
//       if (age > this.expirationHours * 60 * 60 * 1000) {
//         return { valid: false, error: "QR code expired" };
//       }
//     }

//     if (payload.checksum) {
//       const hmac = crypto.createHmac("sha256", this.secretKey);
//       const { checksum, ...data } = payload;
//       const hmacData = `${data.type}:${data.transactionId}:${data.storeId}`;
//       hmac.update(hmacData);
//       if (hmac.digest("hex") !== checksum) {
//         return { valid: false, error: "Invalid QR checksum" };
//       }
//     }

//     return { valid: true, data: payload };
//   }

//   /**
//    * Decode a QR string into its payload object (for display/audit only)
//    */
//   decodePayload(qrString) {
//     try {
//       return JSON.parse(qrString);
//     } catch (error) {
//       return null;
//     }
//   }

//   /**
//    * Validate and get transaction
//    */
//   async validateAndGetTransaction(qrData) {
//     const validation = this.validateQR(qrData);

//     if (!validation.valid) {
//       throw new AppError(validation.error || "Invalid QR code", 400);
//     }

//     const transaction = await Transaction.findById(validation.data.transactionId)
//       .populate("items.productId")
//       .populate("salesAttendantId", "firstName lastName")
//       .populate("financeAttendantId", "firstName lastName");

//     if (!transaction) {
//       throw new AppError("Transaction not found", 404);
//     }

//     return {
//       transaction,
//       qrType: validation.data.type,
//       step: validation.data.step,
//       metadata: validation.data.metadata,
//     };
//   }
// }

// module.exports = new QRService();


































const crypto = require("crypto");
const QRCode = require("qrcode");
const { AppError } = require("../middleware/errorHandler");
const Transaction = require("../models/Transaction");

class QRService {
  constructor() {
    this.secretKey = this.getSecureKey(
      process.env.QR_SECRET_KEY || "default-secret-key-change-in-production"
    );
    this.algorithm = "aes-256-gcm";
    this.expirationHours = 24;
  }

  getSecureKey(input) {
    return crypto.createHash('sha256').update(input).digest();
  }

  /**
   * Generate MINIMAL compact payload - only essential data
   * CRITICAL: Keep payload as small as possible for QR code scannability
   */
  generatePayload(data) {
    // CRITICAL FIX: Only include the store ID, not the full store object
    // The store ID is sufficient - the backend can look up the store
    const storeId = data.storeId && typeof data.storeId === 'object' 
      ? (data.storeId._id || data.storeId.toString()) 
      : data.storeId;

    // Minimal payload with VERY short keys
    const payload = {
      v: "1.0",
      t: data.type,           // S, P, R, I (single letter)
      i: data.transactionId,  // transaction ID
      s: storeId,             // store ID (just the ID, not the full object!)
      st: data.step || data.type,
      ts: Date.now(),
      e: Date.now() + this.expirationHours * 60 * 60 * 1000,
    };

    // Add ONLY essential metadata - keep it minimal
    if (data.metadata) {
      const meta = {};
      // Only include what's absolutely necessary
      if (data.metadata.totalAmount) meta.a = Math.round(data.metadata.totalAmount * 100);
      if (data.metadata.transactionNumber) meta.n = data.metadata.transactionNumber;
      if (data.metadata.invoiceNumber) meta.in = data.metadata.invoiceNumber;
      // Remove itemCount - not needed for validation
      if (Object.keys(meta).length > 0) {
        payload.m = meta;
      }
    }

    // Generate HMAC checksum (16 chars)
    const hmac = crypto.createHmac("sha256", this.secretKey);
    const hmacData = `${payload.i}:${payload.t}:${payload.ts}:${payload.s}`;
    hmac.update(hmacData);
    payload.ch = hmac.digest("hex").substring(0, 16);

    // Log payload size for debugging
    const jsonString = JSON.stringify(payload);
    console.log('[QRService] Payload size:', {
      length: jsonString.length,
      preview: jsonString.substring(0, 100),
    });

    return payload;
  }

  /**
   * Generates a QR code and returns BOTH representations
   */
  async generateQR(data) {
    try {
      const payload = this.generatePayload(data);
      let jsonString = JSON.stringify(payload);

      // If still too large, aggressively truncate metadata
      if (jsonString.length > 500) {
        // Remove metadata entirely
        delete payload.m;
        jsonString = JSON.stringify(payload);
      }

      // If still too large, use minimal version
      if (jsonString.length > 500) {
        const minimal = {
          v: payload.v,
          t: payload.t,
          i: payload.i,
          s: payload.s,
          ts: payload.ts,
          e: payload.e,
          ch: payload.ch,
        };
        jsonString = JSON.stringify(minimal);
      }

      console.log('[QRService] Final QR payload size:', {
        length: jsonString.length,
        preview: jsonString.substring(0, 100),
      });

      const dataUrl = await this._generateQRCode(jsonString);

      return { 
        dataUrl,
        qrString: jsonString,
        payload 
      };
    } catch (error) {
      console.error("QR Generation Error:", error);
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  async _generateQRCode(jsonString) {
    const qrOptions = {
      errorCorrectionLevel: 'M',  // Medium is fine for short payloads
      margin: 2,
      width: 250,
    };

    try {
      return await QRCode.toDataURL(jsonString, qrOptions);
    } catch (error) {
      if (error.message.includes('too big')) {
        qrOptions.version = 20;
        return await QRCode.toDataURL(jsonString, qrOptions);
      }
      throw error;
    }
  }

  validateQR(qrData) {
    try {
      let payload;
      try {
        payload = JSON.parse(qrData);
      } catch (e) {
        try {
          const decoded = Buffer.from(qrData, 'base64').toString('utf8');
          payload = JSON.parse(decoded);
        } catch (e2) {
          return { valid: false, error: "Invalid QR code format" };
        }
      }

      const isCompact = payload.v !== undefined && payload.i !== undefined && payload.t !== undefined;

      if (isCompact) {
        return this._validateCompactPayload(payload);
      }

      if (payload.transactionId) {
        return this._validateLegacyPayload(payload);
      }

      return { valid: false, error: "Invalid QR code structure" };
    } catch (error) {
      console.error("QR Validation Error:", error);
      return { valid: false, error: error.message };
    }
  }

  _validateCompactPayload(payload) {
    if (payload.e && Date.now() > payload.e) {
      return { valid: false, error: "QR code expired" };
    }

    if (payload.ts) {
      const age = Date.now() - payload.ts;
      if (age > this.expirationHours * 60 * 60 * 1000) {
        return { valid: false, error: "QR code expired" };
      }
    }

    if (payload.ch) {
      const hmac = crypto.createHmac("sha256", this.secretKey);
      const hmacData = `${payload.i}:${payload.t}:${payload.ts}:${payload.s}`;
      hmac.update(hmacData);
      const expectedChecksum = hmac.digest("hex").substring(0, 16);
      
      if (payload.ch !== expectedChecksum) {
        return { valid: false, error: "Invalid QR checksum" };
      }
    }

    const typeMap = {
      'S': 'SALES',
      'P': 'PAYMENT',
      'R': 'RELEASE',
      'I': 'INVOICE'
    };

    return {
      valid: true,
      data: {
        version: payload.v,
        type: typeMap[payload.t] || payload.t,
        transactionId: payload.i,
        storeId: payload.s,
        step: payload.st || payload.t,
        timestamp: payload.ts,
        expiresAt: payload.e,
        metadata: payload.m ? {
          totalAmount: payload.m.a ? payload.m.a / 100 : undefined,
          transactionNumber: payload.m.n,
          invoiceNumber: payload.m.in,
        } : {},
      }
    };
  }

  _validateLegacyPayload(payload) {
    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      return { valid: false, error: "QR code expired" };
    }

    if (payload.timestamp) {
      const age = Date.now() - payload.timestamp;
      if (age > this.expirationHours * 60 * 60 * 1000) {
        return { valid: false, error: "QR code expired" };
      }
    }

    if (payload.checksum) {
      const hmac = crypto.createHmac("sha256", this.secretKey);
      const { checksum, ...data } = payload;
      const hmacData = `${data.type}:${data.transactionId}:${data.storeId}`;
      hmac.update(hmacData);
      if (hmac.digest("hex") !== checksum) {
        return { valid: false, error: "Invalid QR checksum" };
      }
    }

    return { valid: true, data: payload };
  }

  decodePayload(qrString) {
    try {
      return JSON.parse(qrString);
    } catch (error) {
      return null;
    }
  }

  async validateAndGetTransaction(qrData) {
    const validation = this.validateQR(qrData);

    if (!validation.valid) {
      throw new AppError(validation.error || "Invalid QR code", 400);
    }

    const transaction = await Transaction.findById(validation.data.transactionId)
      .populate("items.productId")
      .populate("salesAttendantId", "firstName lastName")
      .populate("financeAttendantId", "firstName lastName");

    if (!transaction) {
      throw new AppError("Transaction not found", 404);
    }

    return {
      transaction,
      qrType: validation.data.type,
      step: validation.data.step,
      metadata: validation.data.metadata,
    };
  }
}

module.exports = new QRService();