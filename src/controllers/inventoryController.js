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

    const result = await InventoryService.adjustStock(
      productId,
      req.user.storeId,
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

    const result = await InventoryService.bulkAdjustStock(
      adjustments,
      req.user._id,
      req.user.storeId,
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
    const items = await InventoryService.getLowStockItems(req.user.storeId);

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
    const storeId = req.user.storeId._id || req.user.storeId;

    const summary = await InventoryService.getInventorySummary(storeId);
    

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
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
    const inventory = await InventoryService.getInventoryByProduct(
      productId,
      req.user.storeId
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