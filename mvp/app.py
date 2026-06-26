import os
import sys
import re
import datetime
import logging
import gradio as gr

# Setup system logging
logging.basicConfig(
    level=logging.WARNING,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# -------------------------------------------------------------
# MENU INGESTION & ROBUST DATA PARSING
# -------------------------------------------------------------
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_FILE = os.path.join(ROOT_DIR, "Types_of_Base.txt")
PIZZA_FILE = os.path.join(ROOT_DIR, "Types_of_Pizza.txt")
TOPPING_FILE = os.path.join(ROOT_DIR, "Types_of_Toppings.txt")

def load_menu_file(file_path, file_desc):
    """Loads and validates a menu file, returning a list of dicts.
    Enforces graceful failure modes as required by the spec.
    """
    if not os.path.exists(file_path):
        print(f"Error: Menu file {os.path.basename(file_path)} not found. Please check and restart.")
        sys.exit(1)

    items = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        for i, line in enumerate(lines, 1):
            line_str = line.strip()
            if not line_str:
                continue
                
            parts = line_str.split(';')
            if len(parts) != 3:
                # Malformed line: missing field -> skip, log warning
                print(f"Warning: Malformed line {i} in {os.path.basename(file_path)}: '{line_str}'. Skipping.")
                continue
                
            item_id, name, price_str = parts
            try:
                price = float(price_str)
            except ValueError:
                # Malformed line: non-numeric price -> skip, log warning
                print(f"Warning: Non-numeric price on line {i} in {os.path.basename(file_path)}: '{price_str}'. Skipping.")
                continue
                
            items.append({
                "id": item_id,
                "name": name,
                "price": price
            })
    except Exception as e:
        print(f"Error: Failed to read menu file {os.path.basename(file_path)}: {str(e)}")
        sys.exit(1)

    if not items:
        # Empty menu after parsing -> refuse to start, tell operator which file is empty
        print(f"Error: Menu file {os.path.basename(file_path)} has zero valid records after parsing. Refusing to start.")
        sys.exit(1)
        
    return items

# Ingest all menu data at startup
BASES = load_menu_file(BASE_FILE, "Bases Crust")
PIZZAS = load_menu_file(PIZZA_FILE, "Pizza Choices")
TOPPINGS = load_menu_file(TOPPING_FILE, "Add-on Toppings")

# Create Menu Display markdown lists
def generate_menu_markdown():
    md = "### 🍕 SliceMatic Digital Menu\n\n"
    
    md += "#### 1. Pizza Crust Bases\n"
    for i, base in enumerate(BASES, 1):
        md += f"**{i}**. {base['name']} - Rs. {int(base['price'])}\n"
        
    md += "\n#### 2. Classic Pizzas\n"
    for i, pizza in enumerate(PIZZAS, 1):
        md += f"**{i}**. {pizza['name']} - Rs. {int(pizza['price'])}\n"
        
    md += "\n#### 3. Fresh Add-on Toppings\n"
    for i, topping in enumerate(TOPPINGS, 1):
        md += f"**{i}**. {topping['name']} - Rs. {int(topping['price'])}\n"
        
    return md

MENU_MARKDOWN = generate_menu_markdown()

# -------------------------------------------------------------
# ORDER LOG WRITER
# -------------------------------------------------------------
LOG_FILE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "orders_log.txt")

def append_order_to_log(timestamp, name, phone, pizzas_str, qty, subtotal, discount, gst, total, pay_mode):
    """Appends order record to flat log file. Handles writes blocks gracefully."""
    log_line = (
        f"{timestamp} | {name} | {phone} | "
        f"{pizzas_str} | "
        f"Qty:{qty} | Subtotal:{subtotal:.2f} | "
        f"Discount:{discount:.2f} | GST:{gst:.2f} | "
        f"Total:{total:.2f} | Pay:{pay_mode}\n\n"
    )
    
    try:
        # Create file if missing, append if exists
        with open(LOG_FILE_PATH, 'a', encoding='utf-8') as f:
            f.write(log_line)
        return True
    except IOError as e:
        # Graceful write failure: warn operator, do not crash
        print(f"Warning: Failed to persist order record to local log: {str(e)}. Order processed offline.")
        return False

# -------------------------------------------------------------
# CORE LOGIC VALIDATORS & ORDER CONTROLLER
# -------------------------------------------------------------
def resolve_selection(raw_val, items_list):
    """Resolves menu items from either the dropdown string representation
    or an index string for backward compatibility.
    """
    if not raw_val:
        return None
    raw_str = str(raw_val).strip()
    
    # 1. Try matching by dropdown string representation "Name - Rs. Price"
    for item in items_list:
        opt_str = f"{item['name']} - Rs. {int(item['price'])}"
        if opt_str == raw_str:
            return item
            
    # 2. Try matching by index (for backward compatibility / test scripts)
    try:
        idx = int(raw_str) - 1
        if 0 <= idx < len(items_list):
            return items_list[idx]
    except ValueError:
        pass
        
    return None

def process_order(name, phone, qty_raw, pay_mode, *pizza_details):
    """Validates inputs, processes calculations, and writes sales logs.
    Returns success HTML invoice or structured validation error block.
    """
    errors = []
    
    # 1. Validate Customer Name
    name_stripped = name.strip() if name else ""
    if not name_stripped:
        errors.append("Name must be 2–40 letters (spaces allowed), no numbers.")
    elif not re.match(r"^[A-Za-z ]{2,40}$", name_stripped):
        errors.append("Name must be 2–40 letters (spaces allowed), no numbers.")
        
    # 2. Validate Customer Phone
    phone_stripped = phone.strip() if phone else ""
    if not phone_stripped:
        errors.append("Enter a 10-digit Indian mobile starting with 6, 7, 8, or 9.")
    elif not re.match(r"^[6-9][0-9]{9}$", phone_stripped):
        errors.append("Enter a 10-digit Indian mobile starting with 6, 7, 8, or 9.")
        
    # 3. Validate Quantity Selection (FR-4)
    qty_val = None
    try:
        qty_val = int(qty_raw)
    except (ValueError, TypeError):
        errors.append("Quantity must be a whole number from 1 to 10.")
        
    if qty_val is not None:
        if qty_val <= 0 or qty_val > 10:
            if qty_val > 10:
                errors.append("Maximum order is 10 pizzas per order.")
            else:
                errors.append("Quantity must be a whole number from 1 to 10.")

    # 4. Resolve and Validate selections for each active pizza slot
    parsed_items = []
    if qty_val is not None and 1 <= qty_val <= 10:
        for idx in range(1, qty_val + 1):
            base_idx = (idx - 1) * 3
            pizza_idx = (idx - 1) * 3 + 1
            topping_idx = (idx - 1) * 3 + 2
            
            b_raw = pizza_details[base_idx] if base_idx < len(pizza_details) else None
            p_raw = pizza_details[pizza_idx] if pizza_idx < len(pizza_details) else None
            t_raw = pizza_details[topping_idx] if topping_idx < len(pizza_details) else None
            
            selected_base = resolve_selection(b_raw, BASES)
            selected_pizza = resolve_selection(p_raw, PIZZAS)
            selected_topping = resolve_selection(t_raw, TOPPINGS)
            
            if not selected_base:
                errors.append(f"Pizza #{idx}: Please select a Crust Base Choice.")
            if not selected_pizza:
                errors.append(f"Pizza #{idx}: Please select a Pizza Choice.")
            if not selected_topping:
                errors.append(f"Pizza #{idx}: Please select an Add-on Topping.")
                
            if selected_base and selected_pizza and selected_topping:
                parsed_items.append((selected_base, selected_pizza, selected_topping))

    # Render error messages in a styled container if validation fails
    if errors:
        error_html = "<div style='background-color: #fef2f2; border: 1px dashed #ef4444; border-radius: 8px; padding: 16px; color: #b91c1c; font-family: sans-serif; font-size: 13px; margin-bottom: 12px;'>"
        error_html += "<strong>⚠️ Order Validation Failed:</strong><ul style='margin-top: 8px; padding-left: 20px;'>"
        for err in errors:
            error_html += f"<li>{err}</li>"
        error_html += "</ul></div>"
        return error_html, "<div style='text-align: center; color: gray; margin-top: 40px;'>Receipt will be generated here upon order validation.</div>"

    # 5. Core Pricing Calculations
    subtotal = 0.0
    item_details_list = []
    
    for idx, (sb, sp, st) in enumerate(parsed_items, 1):
        pizza_unit_price = sb['price'] + sp['price'] + st['price']
        subtotal += pizza_unit_price
        item_details_list.append({
            "index": idx,
            "base": sb,
            "pizza": sp,
            "topping": st,
            "unit_price": pizza_unit_price
        })
        
    # Auto-apply 10% discount when qty >= 5 (FR-9)
    discount = 0.0
    if qty_val >= 5:
        discount = subtotal * 0.10
        
    post_discount = subtotal - discount
    gst = post_discount * 0.18  # 18% GST (FR-10)
    net_payable = post_discount + gst
    
    # 6. Persistent Write to Logs
    timestamp = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    
    # Helper to construct details for the log line
    log_parts = []
    for item in item_details_list:
        log_parts.append(
            f"Pizza{item['index']}:"
            f"Base:{item['base']['name']}@{int(item['base']['price'])}/"
            f"Pizza:{item['pizza']['name']}@{int(item['pizza']['price'])}/"
            f"Topping:{item['topping']['name']}@{int(item['topping']['price'])}"
        )
    pizzas_str = " | ".join(log_parts)
    
    write_success = append_order_to_log(
        timestamp, name_stripped, phone_stripped, pizzas_str, 
        qty_val, subtotal, discount, gst, net_payable, pay_mode
    )

    # 7. Render Aligned HTML Invoice Receipt
    discount_line = ""
    if discount > 0:
        discount_line = f"""
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #ef4444; font-weight: bold;">
          <span>DISCOUNT (10% Qty &gt;= 5)</span>
          <span>-Rs. {discount:.2f}</span>
        </div>
        """

    operator_warning = ""
    if not write_success:
        operator_warning = """
        <div style="margin-top: 12px; background-color: #fffbeb; border: 1px solid #f59e0b; border-radius: 6px; padding: 10px; color: #b45309; font-size: 10px; text-align: center;">
          ⚠️ Operator Warning: Order logged offline (File write blocked).
        </div>
        """

    # Build the itemized list in the invoice
    pizza_items_html = ""
    for item in item_details_list:
        pizza_items_html += f"""
        <div style="font-weight: bold; font-size: 11px; margin-top: 8px; color: #ff007f; text-decoration: underline;">Pizza #{item['index']}</div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-left: 8px; margin-top: 2px;">
          <span>{item['base']['name']}</span>
          <span>Rs. {item['base']['price']:.2f}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-left: 8px;">
          <span>{item['pizza']['name']}</span>
          <span>Rs. {item['pizza']['price']:.2f}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-left: 8px; margin-bottom: 2px;">
          <span>{item['topping']['name']}</span>
          <span>Rs. {item['topping']['price']:.2f}</span>
        </div>
        <div style="text-align: right; font-size: 10px; font-weight: bold; opacity: 0.85; margin-bottom: 6px;">
          Subtotal: Rs. {item['unit_price']:.2f}
        </div>
        """

    invoice_html = f"""
    <div style="background-color: #ffffff; border: 1px dashed rgba(0, 0, 0, 0.18); border-radius: 12px; padding: 24px; font-family: monospace; color: #1f2937; max-width: 360px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="text-align: center; margin-bottom: 16px;">
        <strong style="font-size: 18px; letter-spacing: 0.05em; color: #ff007f;">SLICEMATIC PIZZA</strong><br>
        <span style="font-size: 10px; opacity: 0.7;">New Ashok Nagar, Delhi</span>
      </div>
      
      <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
        <span>Date: {timestamp}</span>
        <span>Order Confirmed</span>
      </div>
      <div style="font-size: 11px; margin-bottom: 12px;">
        <span>Customer: {name_stripped} ({phone_stripped})</span>
      </div>
      <div style="border-top: 1px dashed rgba(0, 0, 0, 0.15); margin: 12px 0;"></div>
      
      {pizza_items_html}
      
      <div style="border-top: 1px dashed rgba(0, 0, 0, 0.15); margin: 12px 0;"></div>
      
      <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
        <span>SUBTOTAL ({qty_val} Pizzas)</span>
        <span>Rs. {subtotal:.2f}</span>
      </div>
      {discount_line}
      <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
        <span>POST-DISCOUNT</span>
        <span>Rs. {post_discount:.2f}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
        <span>18% GST (CGST+SGST)</span>
        <span>Rs. {gst:.2f}</span>
      </div>
      <div style="border-top: 3px double rgba(0, 0, 0, 0.25); margin: 12px 0;"></div>
      <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; color: #ff007f;">
        <span>TOTAL NET PAYABLE</span>
        <span>Rs. {net_payable:.2f}</span>
      </div>
      <div style="border-top: 1px dashed rgba(0, 0, 0, 0.15); margin: 12px 0;"></div>
      <div style="display: flex; justify-content: space-between; font-size: 12px;">
        <span>Payment Mode: {pay_mode}</span>
        <span style="color: #10b981; font-weight: bold;">[SUCCESSFUL]</span>
      </div>
      {operator_warning}
      <div style="text-align: center; margin-top: 16px; font-size: 10px; font-style: italic; opacity: 0.7;">
        Thank you for ordering digitally!
      </div>
    </div>
    """
    
    return "", invoice_html

# -------------------------------------------------------------
# GRADIO USER INTERFACE LAYOUT
# -------------------------------------------------------------
with gr.Blocks() as demo:
    gr.Markdown("# 🍕 SliceMatic Digital Ordering Interface")
    gr.Markdown("### Stage 2 MVP — Pricing Validation & Log Persistence Engine")
    
    with gr.Row():
        # LEFT COLUMN: INPUT CONTROLS
        with gr.Column(scale=1):
            gr.Markdown("### 📝 Enter Order Details")
            c_name = gr.Textbox(label="Customer Name", placeholder="e.g. Rajan Sharma")
            c_phone = gr.Textbox(label="10-Digit Phone Number", placeholder="e.g. 9876543210")
            c_qty = gr.Slider(minimum=1, maximum=10, value=1, step=1, label="Quantity")
            
            gr.Markdown("---")
            gr.Markdown("### 🍕 Menu Selection")
            
            # Setup dropdown options mapping
            BASE_CHOICES = [f"{item['name']} - Rs. {int(item['price'])}" for item in BASES]
            PIZZA_CHOICES = [f"{item['name']} - Rs. {int(item['price'])}" for item in PIZZAS]
            TOPPING_CHOICES = [f"{item['name']} - Rs. {int(item['price'])}" for item in TOPPINGS]

            row_components = []
            pizza_inputs = []

            # Dynamically build 10 pizza slot rows, mapping visibility initially to row 1 only
            for i in range(1, 11):
                is_visible = (i == 1)
                with gr.Group(visible=is_visible) as r_grp:
                    gr.Markdown(f"#### 🍕 Pizza #{i}")
                    with gr.Row():
                        b_sel = gr.Dropdown(choices=BASE_CHOICES, label="Crust Base")
                        p_sel = gr.Dropdown(choices=PIZZA_CHOICES, label="Pizza Choice")
                        t_sel = gr.Dropdown(choices=TOPPING_CHOICES, label="Add-on Topping")
                    row_components.append(r_grp)
                    pizza_inputs.extend([b_sel, p_sel, t_sel])
            
            gr.Markdown("---")
            c_pay = gr.Dropdown(choices=["Cash", "Card", "UPI"], value="Cash", label="Payment Mode Selection")
            
            # Validation Error Container inside the left input column
            out_error = gr.HTML(value="", show_label=False)
            
            btn_order = gr.Button("Confirm and Place Order", variant="primary")
            
        # RIGHT COLUMN: MENU VIEW & RECEIPT
        with gr.Column(scale=1):
            with gr.Tab("Active Digital Menus"):
                gr.Markdown(MENU_MARKDOWN)
                
            with gr.Tab("Invoice Bill Receipt"):
                out_receipt = gr.HTML(value="<div style='text-align: center; color: gray; margin-top: 40px;'>Receipt will be generated here upon order validation.</div>")
                
    # Slider Quantity Change visibility mapping
    def update_rows_visibility(qty):
        qty_val = int(qty)
        return [gr.Group(visible=(i < qty_val)) for i in range(10)]

    c_qty.change(
        fn=update_rows_visibility,
        inputs=[c_qty],
        outputs=row_components
    )

    # Event mapping
    btn_order.click(
        fn=process_order,
        inputs=[c_name, c_phone, c_qty, c_pay] + pizza_inputs,
        outputs=[out_error, out_receipt]
    )

if __name__ == "__main__":
    # In sandbox or docker, Gradio listens on local port
    demo.launch(server_name="127.0.0.1", server_port=7860, theme=gr.themes.Soft(primary_hue="pink"))
