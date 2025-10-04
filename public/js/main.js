// Main JavaScript for Expense Management App

document.addEventListener('DOMContentLoaded', function() {
  // Initialize Bootstrap tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function(tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // Initialize Bootstrap popovers
  const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
  popoverTriggerList.map(function(popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });

  // Auto-close alerts after 5 seconds
  setTimeout(function() {
    const alerts = document.querySelectorAll('.alert:not(.alert-permanent)');
    alerts.forEach(function(alert) {
      const bsAlert = new bootstrap.Alert(alert);
      bsAlert.close();
    });
  }, 5000);

  // Receipt file input preview
  const receiptInput = document.getElementById('receipt');
  if (receiptInput) {
    receiptInput.addEventListener('change', function() {
      const previewContainer = document.getElementById('receipt-preview-container');
      if (!previewContainer) return;

      if (this.files && this.files[0]) {
        const file = this.files[0];
        
        // Check file type
        if (file.type.match('image.*')) {
          const reader = new FileReader();
          
          reader.onload = function(e) {
            previewContainer.innerHTML = `
              <div class="mt-3">
                <p class="mb-1">Preview:</p>
                <img src="${e.target.result}" class="receipt-preview" alt="Receipt Preview">
              </div>
            `;
          };
          
          reader.readAsDataURL(file);
        } else if (file.type === 'application/pdf') {
          previewContainer.innerHTML = `
            <div class="mt-3">
              <p class="mb-1">PDF Receipt Selected:</p>
              <div class="alert alert-info">
                <i class="fas fa-file-pdf me-2"></i> ${file.name} (${(file.size / 1024).toFixed(2)} KB)
              </div>
            </div>
          `;
        }
      } else {
        previewContainer.innerHTML = '';
      }
    });
  }

  // Dynamic form fields for workflow steps
  const workflowForm = document.getElementById('workflowForm');
  if (workflowForm) {
    // Role-based field toggling
    const roleSelect = document.getElementById('role');
    if (roleSelect) {
      roleSelect.addEventListener('change', function() {
        const managerField = document.getElementById('manager-field');
        if (managerField) {
          managerField.style.display = this.value === 'Employee' ? 'block' : 'none';
        }
      });
      
      // Trigger on page load
      if (roleSelect.value === 'Employee') {
        const managerField = document.getElementById('manager-field');
        if (managerField) {
          managerField.style.display = 'block';
        }
      }
    }
  }

  // Ensure stepNumber hidden inputs are populated before submitting workflow forms
  const workflowEditForm = document.getElementById('workflowEditForm');
  [workflowForm, workflowEditForm].forEach(form => {
    if (!form) return;
    form.addEventListener('submit', function() {
      const stepCards = form.querySelectorAll('#stepsContainer .card');
      stepCards.forEach((card, idx) => {
        // Find or create hidden input for stepNumber
        let hidden = card.querySelector('input[name^="steps"][name$="[stepNumber]"]');
        if (!hidden) {
          hidden = document.createElement('input');
          hidden.type = 'hidden';
          // Use bracketed index so server receives arrays when multiple steps exist
          hidden.name = `steps[${idx}][stepNumber]`;
          card.insertBefore(hidden, card.firstChild);
        }
        hidden.value = idx + 1;
      });
    });
  });

  // Currency field handling
  const amountInput = document.getElementById('amount');
  const currencySelect = document.getElementById('currency');
  
  if (amountInput && currencySelect) {
    // Format amount with currency symbol
    function updateAmountDisplay() {
      const amount = amountInput.value;
      const currency = currencySelect.value;
      
      const formattedAmount = document.getElementById('formatted-amount');
      if (formattedAmount && amount) {
        // Simple formatting - in real app would use a library or API
        const symbols = {
          'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥',
          'CAD': 'C$', 'AUD': 'A$', 'CHF': 'Fr', 'CNY': '¥',
          'INR': '₹', 'ZAR': 'R', 'SGD': 'S$', 'AED': 'د.إ'
        };
        
        const symbol = symbols[currency] || currency;
        formattedAmount.textContent = `${symbol}${parseFloat(amount).toFixed(2)}`;
      }
    }
    
    amountInput.addEventListener('input', updateAmountDisplay);
    currencySelect.addEventListener('change', updateAmountDisplay);
    
    // Initial update
    if (amountInput.value) {
      updateAmountDisplay();
    }
  }

  // Date range picker for reports
  const dateRangePicker = document.getElementById('date-range');
  if (dateRangePicker) {
    // This would normally use a date range picker library
    // For simplicity, we're just using native date inputs
    const startDate = document.getElementById('start-date');
    const endDate = document.getElementById('end-date');
    
    if (startDate && endDate) {
      // Set default date range to current month
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      
      startDate.valueAsDate = firstDay;
      endDate.valueAsDate = today;
      
      // Ensure end date is not before start date
      startDate.addEventListener('change', function() {
        if (endDate.value && startDate.value > endDate.value) {
          endDate.value = startDate.value;
        }
      });
      
      endDate.addEventListener('change', function() {
        if (startDate.value && endDate.value < startDate.value) {
          startDate.value = endDate.value;
        }
      });
    }
  }

  // Expense filters
  const filterForm = document.getElementById('filter-form');
  if (filterForm) {
    const clearFiltersBtn = document.getElementById('clear-filters');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Reset all form fields
        filterForm.reset();
        
        // Submit the form to refresh results
        filterForm.submit();
      });
    }
  }

  // Toggle manager field based on role selection for manage.ejs
  if (window.location.pathname.includes('/users/manage')) {
    document.querySelectorAll('select[name="role"]').forEach(select => {
      select.addEventListener('change', function() {
        const managerField = this.closest('form').querySelector('.manager-field');
        if (this.value === 'Employee') {
          managerField.style.display = 'block';
        } else {
          managerField.style.display = 'none';
        }
      });
    });
  }
});