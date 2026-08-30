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

  // validateQR(qrData) {
  //   try {
  //     let payload;
  //     try {
  //       payload = JSON.parse(qrData);
  //     } catch (e) {
  //       try {
  //         const decoded = Buffer.from(qrData, 'base64').toString('utf8');
  //         payload = JSON.parse(decoded);
  //       } catch (e2) {
  //         return { valid: false, error: "Invalid QR code format" };
  //       }
  //     }

  //     const isCompact = payload.v !== undefined && payload.i !== undefined && payload.t !== undefined;

  //     if (isCompact) {
  //       return this._validateCompactPayload(payload);
  //     }

  //     if (payload.transactionId) {
  //       return this._validateLegacyPayload(payload);
  //     }

  //     return { valid: false, error: "Invalid QR code structure" };
  //   } catch (error) {
  //     console.error("QR Validation Error:", error);
  //     return { valid: false, error: error.message };
  //   }
  // }

  // _validateCompactPayload(payload) {
  //   if (payload.e && Date.now() > payload.e) {
  //     return { valid: false, error: "QR code expired" };
  //   }

  //   if (payload.ts) {
  //     const age = Date.now() - payload.ts;
  //     if (age > this.expirationHours * 60 * 60 * 1000) {
  //       return { valid: false, error: "QR code expired" };
  //     }
  //   }

  //   if (payload.ch) {
  //     const hmac = crypto.createHmac("sha256", this.secretKey);
  //     const hmacData = `${payload.i}:${payload.t}:${payload.ts}:${payload.s}`;
  //     hmac.update(hmacData);
  //     const expectedChecksum = hmac.digest("hex").substring(0, 16);
      
  //     if (payload.ch !== expectedChecksum) {
  //       return { valid: false, error: "Invalid QR checksum" };
  //     }
  //   }

  //   const typeMap = {
  //     'S': 'SALES',
  //     'P': 'PAYMENT',
  //     'R': 'RELEASE',
  //     'I': 'INVOICE'
  //   };

  //   return {
  //     valid: true,
  //     data: {
  //       version: payload.v,
  //       type: typeMap[payload.t] || payload.t,
  //       transactionId: payload.i,
  //       storeId: payload.s,
  //       step: payload.st || payload.t,
  //       timestamp: payload.ts,
  //       expiresAt: payload.e,
  //       metadata: payload.m ? {
  //         totalAmount: payload.m.a ? payload.m.a / 100 : undefined,
  //         transactionNumber: payload.m.n,
  //         invoiceNumber: payload.m.in,
  //       } : {},
  //     }
  //   };
  // }

  // services/qrService.js

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
  // Check expiration
  if (payload.e && Date.now() > payload.e) {
    return { valid: false, error: "QR code expired" };
  }

  if (payload.ts) {
    const age = Date.now() - payload.ts;
    if (age > this.expirationHours * 60 * 60 * 1000) {
      return { valid: false, error: "QR code expired" };
    }
  }

  // ✅ FIX: Validate checksum if present
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

  // ✅ FIX: Extract storeId safely
  const storeId = payload.s || payload.storeId || null;

  return {
    valid: true,
    data: {
      version: payload.v || "1.0",
      type: typeMap[payload.t] || payload.t || "UNKNOWN",
      transactionId: payload.i || payload.transactionId,
      storeId: storeId,
      step: payload.st || payload.t || "UNKNOWN",
      timestamp: payload.ts || Date.now(),
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

  // async validateAndGetTransaction(qrData) {
  //   const validation = this.validateQR(qrData);

  //   if (!validation.valid) {
  //     throw new AppError(validation.error || "Invalid QR code", 400);
  //   }

  //   const transaction = await Transaction.findById(validation.data.transactionId)
  //     .populate("items.productId")
  //     .populate("salesAttendantId", "firstName lastName")
  //     .populate("financeAttendantId", "firstName lastName");

  //   if (!transaction) {
  //     throw new AppError("Transaction not found", 404);
  //   }

  //   return {
  //     transaction,
  //     qrType: validation.data.type,
  //     step: validation.data.step,
  //     metadata: validation.data.metadata,
  //   };
  // }

  // services/qrService.js

async validateAndGetTransaction(qrData) {
  const validation = this.validateQR(qrData);

  if (!validation.valid) {
    throw new AppError(validation.error || "Invalid QR code", 400);
  }

  // ✅ FIX: Get transaction with proper population
  const transaction = await Transaction.findById(validation.data.transactionId)
    .populate({
      path: "items",
      populate: {
        path: "productId",
        select: "name sku unitPrice taxRate description category brand"
      }
    })
    .populate("salesAttendantId", "firstName lastName email")
    .populate("financeAttendantId", "firstName lastName email")
    .populate("warehouseStaffId", "firstName lastName email")
    .populate("storeId", "name code address phone email");

  if (!transaction) {
    throw new AppError("Transaction not found", 404);
  }

  // ✅ FIX: Ensure storeId is properly populated
  // If storeId is still an ObjectId, fetch it
  if (transaction.storeId && typeof transaction.storeId === 'object' && !transaction.storeId.name) {
    const store = await Store.findById(transaction.storeId._id || transaction.storeId);
    if (store) {
      transaction.storeId = store;
    }
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