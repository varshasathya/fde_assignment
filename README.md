# SliceMatic: Unified Product & Business Economics Deliverables

This repository contains the Stage 1 (PRD & Business Analysis) and Stage 2 (Gradio MVP Validation) implementations for the **SliceMatic** digital pizza ordering platform.

---

## 📁 Repository Structure

```
├── README.md                      # Main project directory entry point
├── index.html                     # Stage 1: Unified HTML Dashboard & Unit Economics Simulator
├── Types_of_Base.txt              # Crust bases configuration data
├── Types_of_Pizza.txt             # Pizza types configuration data
├── Types_of_Toppings.txt          # Topping add-ons configuration data
├── PizzaFlow_Assignment_Brief_FDE.pdf # Original project assignment brief
├── SliceMatic_Stage1_PRD_v03.pdf  # Part A: Stage 1 PRD source
├── SliceMatic_Business_Economics.pdf # Part B: Stage 1 Business deep dive source
├── readme/
│   └── README.md                  # Project overview, challenge responses, and guidelines
└── mvp/
    ├── app.py                     # Stage 2: Gradio python application
    ├── requirements.txt           # Python dependency requirements (Gradio & Pandas)
    ├── README.md                  # Gradio MVP implementation and testing guide
    └── orders_log.txt             # Persistent pipe-separated local checkout logs
```

---

## 🚀 Quick Start Guide

### 1. Stage 1: Business Dashboard & Simulator
To review the product requirements (PRD), business economics analysis, and play with the dynamic unit economics simulator:
- Open the [index.html](index.html) file directly in any modern web browser.
- Adjust sliders (Daily orders, rent, inflation, commission mix) to dynamically see EBITDA, break-even orders, and capital payback periods.

### 2. Stage 2: python Gradio MVP
To run the local digital ordering MVP interface:
- Navigate to the project root directory.
- Install dependencies:
  ```bash
  pip install -r mvp/requirements.txt
  ```
- Launch the application:
  ```bash
  python mvp/app.py
  ```
- Access the web interface at **[http://127.0.0.1:7860](http://127.0.0.1:7860)**.

For detailed documentation, please check the [readme/README.md](readme/README.md) and [mvp/README.md](mvp/README.md) files.
