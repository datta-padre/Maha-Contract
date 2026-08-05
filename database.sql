CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    mobile VARCHAR(15) NOT NULL ,
    email VARCHAR(100) NOT NULL,
    password_hash TEXT NOT NULL,
    role ENUM('admin','user','vendor','contractor','houseowner') NOT NULL,
    address TEXT,
    taluka VARCHAR(100),
    district VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE token_blacklist(
    token_id INT AUTO_INCREMENT PRIMARY KEY,
    token TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tenders(
    tender_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    plotArea VARCHAR(255),
    soilType VARCHAR(100),
    plotLocation TEXT,
    constructionCode VARCHAR(50),
    materialsProvided ENUM('yes', 'no'),
    finalizedPlan ENUM('yes', 'no'),
    ancillary_requirements VARCHAR(255), 
    externalWorks VARCHAR(255),
    boundaryWallType VARCHAR(255),
    budget VARCHAR(255),
    bhk VARCHAR(50),
    floors VARCHAR(255),
    constructionTime VARCHAR(255),
    specialInstructions TEXT,
    architectural_plan TEXT,
    Plot_documents TEXT,
    house_owner_digital_signature TEXT,
    payment_status ENUM('pending', 'paid', 'failed') DEFAULT 'pending',
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_amount INT DEFAULT 0,
    payment_transaction_id VARCHAR(100),
    razorpay_order_id VARCHAR(100),
    payment_transaction_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE materials(
    mat_id INT AUTO_INCREMENT PRIMARY KEY,
    vendor_id INT NOT NULL,    
    matName VARCHAR(255) NOT NULL,
    matCategory ENUM('Cement & Concrete', 'Steel & Metal', 'Bricks & Blocks', 'Wood & Timber', 'Plumbing', 'Electrical', 'Other') NOT NULL,
    matQuantity INT NOT NULL,
    matPrice INT NOT NULL,
    matImage TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contractor_kyc(
    kyc_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    full_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(255),
    location_link TEXT,
    experience VARCHAR(255),
    specialization VARCHAR(255),
    availability VARCHAR(255),
    base_price_range VARCHAR(255),
    profile_picture TEXT,
    digital_signature TEXT,
    qualifications TEXT,
    licenses TEXT,
    adhar_card TEXT,
    pan_card TEXT,
    gst_certificate TEXT,
    insurance_certificate TEXT,
    non_crime_certificate TEXT,
    police_ncertificate TEXT,
    previous_work TEXT,
    legal_agreement TEXT,
    acceptPrivacy BOOLEAN DEFAULT FALSE,
    acceptTerms BOOLEAN DEFAULT FALSE,
    payment_status ENUM('pending', 'paid', 'failed') DEFAULT 'pending',
    contractor_kyc_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    contractor_payment_status ENUM('Advance', 'Intermediate', 'Final') DEFAULT 'Advance',
    payment_amount INT DEFAULT 0,
    payment_transaction_id VARCHAR(100),
    razorpay_order_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

    CREATE TABLE staff(
        staff_id INT AUTO_INCREMENT PRIMARY KEY,
        staff_name VARCHAR(255) NOT NULL,
        staff_email VARCHAR(255) ,
        staff_mobile VARCHAR(15) ,
        staff_password VARCHAR(255),
        staff_role ENUM('VerifyAdmin','BudgetAdmin','MaterialsAdmin') NOT NULL,
        staff_status ENUM('active', 'inactive') DEFAULT 'active',
        staff_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        staff_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

