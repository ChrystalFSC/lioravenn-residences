# Residential Project Website Development

## 1. Introduction

This document outlines the structure, flow, and functionality of the **Residential Project Website**. The website is designed to provide an interactive and visually appealing experience for potential buyers by showcasing the project's floor plans, gallery, concept, and a mortgage calculator.

> **Note:** Some content (e.g., detailed floor plans, gallery images, and project-specific descriptions) will be gathered by your team members. You can use placeholder content for now and update it once the information is available.

## 2. Website Flow

### 🏠 **Landing Page (Home)**
- **Purpose**: Provide an overview of the residential project.
- **Features**:
  - Hero section with a banner image and a brief introduction
  - Navigation menu linking to **Floor Plan, Gallery, Concept, Contact, Mortgage Calculator**
  - Call-to-action button (e.g., "View Floor Plans" or "Register Your Interest")
  - Responsive design for optimal viewing on all devices

### 📐 **Floor Plan Page**
- **Purpose**: Display detailed layouts of residential units.
- **Features**:
  - Interactive floor plan images with hover effects
  - Options to view different unit types (e.g., **1BHK, 2BHK, 3BHK**)
  - Key dimensions and highlights for each unit
  - Option to download PDF versions of floor plans
- **Content**: Detailed floor plans and unit specifications will be provided by the team later.

### 🖼️ **Gallery Page**
- **Purpose**: Showcase high-quality images and videos.
- **Features**:
  - Image gallery with thumbnails and a lightbox effect for full-screen viewing
  - Categorization (e.g., **Interiors, Exteriors, Amenities**)
  - Embedded video tours or 360° views (if available)
- **Content**: Final images will be gathered from free image sites or created by the team.

### 💡 **Concept Page**
- **Purpose**: Explain the design philosophy and vision.
- **Features**:
  - A description of the project's theme, sustainability, and architectural inspiration
  - Visual elements like mood boards, sketches, or infographics
- **Content**: Text and visual elements will be updated once research is complete.

### 📝 **Register for Contact Page**
- **Purpose**: Allow potential buyers to express interest and request more information.
- **Features**:
  - **Google Form Integration**:  
    - Option 1: A button that opens the Google Form in a new tab.
    - Option 2: Embed the Google Form directly within the page.
  - **Fields in the Google Form** include:
    - Full Name
    - Email Address
    - Phone Number
    - Preferred Unit Type (dropdown: 1BHK, 2BHK, 3BHK)
    - Message/Comments
- **Example Implementation**:

  **Link Button Method:**
  ```html
  <a href="https://forms.gle/your-google-form-link" target="_blank">
      <button>Register Your Interest</button>
  </a>
  ```

  **Embedded Form Method:**
  ```html
  <iframe src="https://forms.gle/your-google-form-link" width="100%" height="600px" frameborder="0"></iframe>
  ```
- **Content**: The form details and subsequent data will be collected externally via the Google Form. Update the link once the form is created. Then send the form to admin once filled.

### 🧮 **Mortgage Calculator**
- **Purpose**: Help users estimate their loan repayments.
- **Features**:
  - Input fields for:
    - Loan Amount
    - Annual Interest Rate
    - Loan Tenure (dropdown: 5, 10, 15, 20, 30 years)
    - Down Payment (optional)
  - **Calculate Button** to trigger the computation
  - Display of the monthly repayment amount
- **Content**: Basic financial formulas and examples can be added now, with final details updated later if necessary.

### 🗺️ **Sitemap Section**
- **Purpose**: Provide quick access to important pages.
- **Features**:
  - Quick links to **Home, Floor Plan, Gallery, Concept, Contact, Mortgage Calculator**
  - Social media icons (linked to placeholder profiles)
  - Contact information (address, phone, email) and an embedded Google Maps location

## 3. Technical Stack

### 🖥️ **Frontend Development**
- **Technologies**:
  - HTML, CSS, JavaScript
  - Frameworks: Bootstrap or Tailwind CSS
  - Optional: jQuery for animations
- **Key Features**:
  - Responsive design
  - Smooth navigation and transitions

### ⚙️ **Backend Development (Optional)**
- **Usage**: Only needed if you choose to store form submissions or add dynamic user registration.
- **Options**:
  - PHP, Node.js, Python (Flask/Django)
  - If opting out, the Google Form handles data collection without a backend.

### 🛠️ **Additional Tools**
- **Wireframing & Prototyping**: Figma, Adobe XD, or Canva.
- **Image Optimization**: Compress images for faster load times.

## 4. Content Gathering & Project Timeline

### 📊 **Information to be Collected by Team Members**
| Category | Details to Gather |
|----------|-------------------|
| **Project Details** | Project name, location, brief description, key selling points |
| **Floor Plans** | Detailed images for each unit type, specifications, dimensions |
| **Gallery Images** | High-quality images of interiors, exteriors, amenities |
| **Concept & Vision** | Design philosophy, architectural inspiration, visual materials |
| **Contact Information** | Fictional or real contact details (phone, email, address) |
| **Mortgage Calculator** | Financial formulas, example rates/tenures |

### ⏱️ **Development Timeline**
- **Option 1: Start Developing with Placeholder Content**
  - Begin coding the website using dummy text and images
  - Update the content later once your team gathers the final information
  
- **Option 2: Wait for Final Information**
  - Delay development until all essential content is available to avoid rework
  
> **Recommendation:** Starting with placeholders is usually effective. It lets you build the website structure while your team finalizes the content. Once the information is ready, you can simply replace the placeholders with the final data.

## 5. Deliverables
- **Website Codebase**: HTML, CSS, JavaScript, and any backend scripts (if used)
- **Presentation (5-10 minutes)**: Overview of the project, features, challenges, and solutions
- **Documentation File**:  
  - Project structure explanation
  - Technologies used
  - Future improvement suggestions
- **Google Form**: Integrated on the contact page to collect user registrations

---

> **Final Note:**  
> Even if you begin with placeholder content, ensure your website's design and structure are flexible so that updates can be made easily once all the gathered information is available.
