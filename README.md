
Expense Management Odoo

A full-featured expense management system inspired by Odoo, built with Node.js, Express, MongoDB, and EJS. This application supports multi-role workflows, file uploads, currency conversion, and a modern UI.


---

Table of Contents

Features

Screenshots

Tech Stack

Project Structure

Setup & Installation

Default Admin Login

Configuration

Usage Guide

API Endpoints

Contributing

License



---

Features

User authentication (register, login, profile)

Role-based access: Employee, Manager, Financer, Director, Admin

Expense submission with file upload (receipts)

Approval workflow (multi-step, customizable)

Admin dashboard for managing users, companies, workflows, and expenses

Currency conversion utility

Email notifications for approvals/rejections

Filtering and bulk actions for expenses

Responsive UI with Odoo-inspired color palette



---

Screenshots

> Add screenshots here to showcase login, dashboard, approval workflow, and admin panel.




---

Tech Stack

Backend: Node.js, Express.js

Database: MongoDB (Mongoose ODM)

Authentication: Passport.js

Templating: EJS

UI: Bootstrap 5, Custom CSS

File Uploads: Multer

Utilities: dotenv, currency-converter-lt



---

Project Structure

expensemanagementodoo/
├── app.js                  # Main Express app
├── package.json            # Dependencies & scripts
├── config/
│   └── passport.js         # Passport config
├── middleware/
│   └── auth.js             # Auth middleware
├── models/
│   ├── ApprovalWorkflow.js # Approval workflow model
│   ├── Company.js          # Company model
│   ├── Expense.js          # Expense model
│   └── User.js             # User model
├── public/
│   ├── css/style.css       # Custom styles
│   ├── js/main.js          # Client-side JS
│   └── uploads/            # Uploaded receipts
├── routes/
│   ├── admin.js            # Admin routes
│   ├── approvals.js        # Approval workflow routes
│   ├── expenses.js         # Expense routes
│   ├── index.js            # General routes
│   └── users.js            # User routes
├── utils/
│   ├── currencyConverter.js# Currency conversion
│   └── emailSender.js      # Email utility
├── views/
│   ├── layout.ejs          # Main layout
│   ├── ...                 # All EJS templates
└── README.md               # Project documentation


---

Setup & Installation

1. Clone the repository

git clone <repo-url>
cd expensemanagementodoo


2. Install dependencies

npm install


3. Configure environment variables

Copy .env.example to .env and fill in:

MONGO_URI (MongoDB connection string)

EMAIL_USER, EMAIL_PASS (for notifications)

Other required settings




4. Run the application

npm start

The app runs at http://localhost:5000 by default.




---

Default Admin Login

For initial access to the Admin Dashboard, use the following credentials:

Admin Email: mudaliyarvijay520@gmail.com

Password: 123456789


> ⚠️ It is strongly recommended to change this password immediately after first login for security purposes.




---

Configuration

MongoDB: Required for data storage. Use MongoDB Atlas or local instance.

Email: SMTP credentials for sending notifications (see utils/emailSender.js).

File Uploads: Receipts are stored in public/uploads/.

Roles: Set user roles in the database for access control.



---

Usage Guide

Register/Login: Create an account and log in.

Submit Expense: Fill out the expense form, upload receipt, and submit.

Approval Workflow: Managers/Approvers review, approve, or reject expenses.

Admin Panel: Admins manage users, companies, workflows, and view all expenses.

Bulk Actions: Select multiple expenses for bulk deletion.

Filtering: Filter expenses by status, user, category, and date range.



---

API Endpoints

> This app is primarily server-rendered, but key routes include:



/users/register - Register new user

/users/login - Login

/expenses/new - Submit new expense

/expenses/dashboard - User dashboard

/admin/expenses - Admin expense management

/admin/users - Admin user management

/admin/workflows - Manage approval workflows



---

Contributing

1. Fork the repository


2. Create your feature branch (git checkout -b feature/YourFeature)


3. Commit your changes (git commit -am 'Add new feature')


4. Push to the branch (git push origin feature/YourFeature)


5. Create a new Pull Request




---

License

MIT


---

Author

Mudaliyar1


---

Acknowledgements

Inspired by Odoo ERP

Bootstrap, MongoDB, Node.js, Express, Passport.js



---

Contact

For questions or support, open an issue or contact the author via GitHub.
