const CC = require('currency-converter-lt');
const moment = require('moment');

/**
 * Currency converter utility for expense management
 * Uses currency-converter-lt package for real-time conversion
 */
class CurrencyConverter {
  constructor() {
    this.converter = new CC();
    this.lastUpdated = null;
    this.updateRates();
  }

  /**
   * Update currency rates (should be called daily)
   */
  async updateRates() {
    try {
      await this.converter.loadRates();
      this.lastUpdated = moment().format('YYYY-MM-DD HH:mm:ss');
      console.log(`Currency rates updated at ${this.lastUpdated}`);
      return true;
    } catch (error) {
      console.error('Error updating currency rates:', error);
      return false;
    }
  }

  /**
   * Convert amount from one currency to another
   * @param {Number} amount - Amount to convert
   * @param {String} fromCurrency - Source currency code (e.g., 'USD')
   * @param {String} toCurrency - Target currency code (e.g., 'EUR')
   * @returns {Promise<Number>} - Converted amount
   */
  async convert(amount, fromCurrency, toCurrency) {
    // If currencies are the same, no conversion needed
    if (fromCurrency === toCurrency) {
      return parseFloat(amount);
    }

    try {
      // Check if rates need updating (once per day)
      const today = moment().format('YYYY-MM-DD');
      const lastUpdateDay = this.lastUpdated ? moment(this.lastUpdated).format('YYYY-MM-DD') : null;
      
      if (!lastUpdateDay || lastUpdateDay !== today) {
        await this.updateRates();
      }

      // Perform conversion
      const result = await this.converter.convert(amount, fromCurrency, toCurrency);
      return parseFloat(result.toFixed(2));
    } catch (error) {
      console.error(`Error converting ${amount} from ${fromCurrency} to ${toCurrency}:`, error);
      // Fallback: return original amount if conversion fails
      return parseFloat(amount);
    }
  }

  /**
   * Get currency symbol for a currency code
   * @param {String} currencyCode - Currency code (e.g., 'USD')
   * @returns {String} - Currency symbol (e.g., '$')
   */
  getSymbol(currencyCode) {
    const symbols = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'CAD': 'C$',
      'AUD': 'A$',
      'CHF': 'Fr',
      'CNY': '¥',
      'INR': '₹',
      'ZAR': 'R',
      'SGD': 'S$',
      'AED': 'د.إ'
    };
    
    return symbols[currencyCode] || currencyCode;
  }

  /**
   * Format amount with currency symbol
   * @param {Number} amount - Amount to format
   * @param {String} currencyCode - Currency code
   * @returns {String} - Formatted amount with symbol
   */
  formatAmount(amount, currencyCode) {
    const symbol = this.getSymbol(currencyCode);
    return `${symbol}${parseFloat(amount).toFixed(2)}`;
  }
}

// Create singleton instance
const currencyConverter = new CurrencyConverter();

module.exports = currencyConverter;