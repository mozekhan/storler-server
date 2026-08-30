// const InventoryService = require('../services/inventoryService');

// /**
//  * Get inventory list
//  */
// exports.getInventory = async (req, res) => {
//   try {
//     const result = await InventoryService.getInventory(req.query, req.user);

//     res.json({
//       success: true,
//       data: result
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

// /**
//  * Adjust stock
//  */
// exports.adjustStock = async (req, res) => {
//   try {
//     const { productId, quantity, reason } = req.body;

//     if (!reason) {
//       return res.status(400).json({
//         success: false,
//         message: 'Reason is required for stock adjustment'
//       });
//     }

//     const result = await InventoryService.adjustStock(
//       productId,
//       req.user.storeId,
//       quantity,
//       reason,
//       req.user._id,
//       req.ip,
//       req.headers['user-agent']
//     );

//     res.json({
//       success: true,
//       data: result
//     });
//   } catch (error) {
//     res.status(error.statusCode || 500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

// /**
//  * Bulk adjust stock
//  */
// exports.bulkAdjustStock = async (req, res) => {
//   try {
//     const { adjustments } = req.body;

//     if (!Array.isArray(adjustments) || adjustments.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'Adjustments array is required'
//       });
//     }

//     const result = await InventoryService.bulkAdjustStock(
//       adjustments,
//       req.user._id,
//       req.user.storeId,
//       req.ip,
//       req.headers['user-agent']
//     );

//     res.json({
//       success: true,
//       data: result
//     });
//   } catch (error) {
//     res.status(error.statusCode || 500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

// /**
//  * Get low stock items
//  */
// exports.getLowStockItems = async (req, res) => {
//   try {
//     const items = await InventoryService.getLowStockItems(req.user.storeId);

//     res.json({
//       success: true,
//       data: items
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

// /**
//  * Get inventory summary
//  */
// exports.getInventorySummary = async (req, res) => {
//   try {
//     const storeId = req.user.storeId._id || req.user.storeId;

//     const summary = await InventoryService.getInventorySummary(storeId);
    

//     res.json({
//       success: true,
//       data: summary
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

// /**
//  * Get inventory by product
//  */
// exports.getInventoryByProduct = async (req, res) => {
//   try {
//     const { productId } = req.params;
//     const inventory = await InventoryService.getInventoryByProduct(
//       productId,
//       req.user.storeId
//     );

//     res.json({
//       success: true,
//       data: inventory
//     });
//   } catch (error) {
//     res.status(error.statusCode || 500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

























// controllers/inventoryController.js
const InventoryService = require('../services/inventoryService');

/**
 * Get inventory list
 */
exports.getInventory = async (req, res) => {
  try {
    const result = await InventoryService.getInventory(req.query, req.user);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Adjust stock
 */
exports.adjustStock = async (req, res) => {
  try {
    const { productId, quantity, reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required for stock adjustment'
      });
    }

    // ✅ FIX: Get storeId based on user role
    let storeId;
    if (req.user.role === 'SUPER_ADMIN') {
      // Super Admin must specify a storeId for the product
      storeId = req.body.storeId;
      if (!storeId) {
        return res.status(400).json({
          success: false,
          message: 'Store ID is required for Super Admin'
        });
      }
    } else {
      storeId = req.user.storeId?._id || req.user.storeId;
      if (!storeId) {
        return res.status(400).json({
          success: false,
          message: 'Store ID not found for user'
        });
      }
    }

    const result = await InventoryService.adjustStock(
      productId,
      storeId,
      quantity,
      reason,
      req.user._id,
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Bulk adjust stock
 */
exports.bulkAdjustStock = async (req, res) => {
  try {
    const { adjustments } = req.body;

    if (!Array.isArray(adjustments) || adjustments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Adjustments array is required'
      });
    }

    // ✅ FIX: Get storeId based on user role
    let storeId;
    if (req.user.role === 'SUPER_ADMIN') {
      // Super Admin must specify a storeId in the request
      storeId = req.body.storeId;
      if (!storeId) {
        return res.status(400).json({
          success: false,
          message: 'Store ID is required for Super Admin'
        });
      }
    } else {
      storeId = req.user.storeId?._id || req.user.storeId;
      if (!storeId) {
        return res.status(400).json({
          success: false,
          message: 'Store ID not found for user'
        });
      }
    }

    const result = await InventoryService.bulkAdjustStock(
      adjustments,
      req.user._id,
      storeId,
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get low stock items
 */
exports.getLowStockItems = async (req, res) => {
  try {
    // ✅ FIX: Get storeId based on user role
    let storeId;
    if (req.user.role === 'SUPER_ADMIN') {
      storeId = req.query.storeId;
      if (!storeId) {
        // Super Admin with no storeId filter - get all stores
        const Store = require('../models/Store');
        const allStores = await Store.find({ isActive: true }).select('_id');
        storeId = allStores.map(s => s._id);
      }
    } else {
      storeId = req.user.storeId?._id || req.user.storeId;
      if (!storeId) {
        return res.status(400).json({
          success: false,
          message: 'Store ID not found for user'
        });
      }
    }

    const items = await InventoryService.getLowStockItems(storeId);

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get inventory summary
 */
exports.getInventorySummary = async (req, res) => {
  try {
    // ✅ FIX: Get storeId based on user role
    let storeId;
    if (req.user.role === 'SUPER_ADMIN') {
      storeId = req.query.storeId;
      if (!storeId) {
        // Super Admin with no storeId - return summary for all stores or error
        return res.status(400).json({
          success: false,
          message: 'Store ID is required for Super Admin or use store filter'
        });
      }
    } else {
      storeId = req.user.storeId?._id || req.user.storeId;
      if (!storeId) {
        return res.status(400).json({
          success: false,
          message: 'Store ID not found for user'
        });
      }
    }

    const summary = await InventoryService.getInventorySummary(storeId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Get inventory summary error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get inventory by product
 */
exports.getInventoryByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    // ✅ FIX: Get storeId based on user role
    let storeId;
    if (req.user.role === 'SUPER_ADMIN') {
      storeId = req.query.storeId;
      if (!storeId) {
        return res.status(400).json({
          success: false,
          message: 'Store ID is required for Super Admin'
        });
      }
    } else {
      storeId = req.user.storeId?._id || req.user.storeId;
      if (!storeId) {
        return res.status(400).json({
          success: false,
          message: 'Store ID not found for user'
        });
      }
    }

    const inventory = await InventoryService.getInventoryByProduct(
      productId,
      storeId
    );

    res.json({
      success: true,
      data: inventory
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });
  }
};