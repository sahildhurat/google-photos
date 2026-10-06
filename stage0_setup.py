import json
import os
import random
from PIL import Image, ImageDraw, ImageFont

def generate_catalogue():
    records = []
    
    # 1. c_hampi_cafe (5 records, near_identical: true, photo)
    hampi_scenes = [
        ("p_0001", "Small cafe interior, yellow-washed wall, blue plastic chairs, one person at a table with a cold coffee", ["the cold coffee glass is full", "a menu on the table"]),
        ("p_0002", "Small cafe interior, yellow-washed wall, blue plastic chairs, one person at a table with a cold coffee", ["the cold coffee glass is almost empty", "a scooter helmet on the chair beside him"]),
        ("p_0003", "Small cafe interior, yellow-washed wall, blue plastic chairs, one person at a table with a cold coffee", ["she is wearing a watch", "the coffee is empty"]),
        ("p_0004", "Small cafe interior, yellow-washed wall, green plastic chairs, one person at a table with a cold coffee", ["a stray dog sleeping in the background", "coffee is full"]),
        ("p_0005", "Small cafe interior, yellow-washed wall, green plastic chairs, one person at a table with a cold coffee", ["a dropped spoon on the floor", "coffee is empty"]),
    ]
    for i, (id_, scene, visible) in enumerate(hampi_scenes):
        records.append({
            "id": id_,
            "file": f"images/{id_}.jpg",
            "taken_at": f"2019-08-17T09:4{2+i}:00+05:30",
            "place": { "name": "Hampi", "area": "Hampi, Karnataka" },
            "people": ["Dev"] if i in [0, 1, 3] else ["Kavya"],
            "kind": "photo",
            "scene": scene,
            "visible_only_on_close_look": visible,
            "cluster": "c_hampi_cafe",
            "near_identical": True,
            "opened_since_capture": False,
            "user_deposits": []
        })

    # 2. c_laughing (6 records, near_identical: true, photo)
    for i in range(11, 17):
        id_ = f"p_00{i}"
        closed = (i == 16)
        visible = ["eyes are almost closed", "hair is across her face"] if closed else ["eyes are open", "a half eaten cake on the table"]
        records.append({
            "id": id_,
            "file": f"images/{id_}.jpg",
            "taken_at": f"2022-04-12T19:20:{i}0+05:30",
            "place": { "name": "Bangalore", "area": "Indiranagar" },
            "people": ["Priya"],
            "kind": "photo",
            "scene": "A woman laughing at a dinner table, warm restaurant lighting",
            "visible_only_on_close_look": visible,
            "cluster": "c_laughing",
            "near_identical": True,
            "opened_since_capture": False if i < 14 else True,
            "user_deposits": []
        })

    # 3. c_receipts (4 records, near_identical: true, receipt)
    for i, year in enumerate([2021, 2022, 2023, 2024]):
        id_ = f"p_00{21+i}"
        records.append({
            "id": id_,
            "file": f"images/{id_}.jpg",
            "taken_at": f"{year}-11-05T10:00:00+05:30",
            "place": None,
            "people": [],
            "kind": "receipt",
            "scene": "Printed store receipt from a supermarket on white thermal paper",
            "visible_only_on_close_look": [f"the date says {year}", "the total amount is Rs 450"],
            "cluster": "c_receipts",
            "near_identical": True,
            "opened_since_capture": False,
            "user_deposits": []
        })

    # 4. c_trek (8 records, near_identical: false, photo)
    trek_scenes = [
        "Group of three people standing at the start of a mountain trail in morning mist",
        "A steep rocky section of a trail with one person climbing ahead",
        "Three people taking a break on a fallen log, drinking water",
        "View of a valley from a high vantage point, two people pointing at the distance",
        "One person adjusting their backpack straps against a backdrop of pine trees",
        "The group eating sandwiches sitting on a rocky outcrop",
        "A small mountain stream crossing with stones serving as steps",
        "The three friends posing at the summit marker with tired but happy expressions"
    ]
    trek_people = [["Dev", "Priya", "Amit"], ["Dev"], ["Dev", "Priya", "Amit"], ["Priya", "Amit"], ["Dev"], ["Dev", "Priya", "Amit"], [], ["Dev", "Priya", "Amit"]]
    for i in range(8):
        id_ = f"p_00{31+i}"
        records.append({
            "id": id_,
            "file": f"images/{id_}.jpg",
            "taken_at": f"2023-10-15T{8+i}:15:00+05:30",
            "place": { "name": "Triund", "area": "Himachal Pradesh" },
            "people": trek_people[i],
            "kind": "photo",
            "scene": trek_scenes[i],
            "visible_only_on_close_look": ["small red trail marker on a tree", "Amit is wearing a blue beanie"],
            "cluster": "c_trek",
            "near_identical": False,
            "opened_since_capture": True,
            "user_deposits": []
        })

    # 5. Standalone records (22 records, near_identical: false, mixed kinds)
    # food 3, city streets 3, family at home 3, screenshots/documents 6, wedding 2, train journey 2, pets 2, accidental 1 = 22
    names_pool = ["Dev", "Priya", "Amit", "Kavya", "Rohan", "Amma", "Nani", "Ishaan"]
    
    standalones = [
        # Food (3)
        ("p_0101", "photo", "A plate of masala dosa and chutney on a banana leaf", ["the edge of a steel tumbler is visible", "some sambar spilled on the leaf"]),
        ("p_0102", "photo", "Two ice cream cones held up against a blurry street background", ["one is chocolate, one is strawberry", "a street lamp in the background"]),
        ("p_0103", "photo", "A large homemade chocolate cake with white frosting on a dining table", ["it says Happy Birthday in red gel", "three unlit candles"]),
        # Streets (3)
        ("p_0104", "photo", "A busy auto rickshaw stand in the evening traffic", ["license plate KA01 starts on the closest auto", "a person selling balloons"]),
        ("p_0105", "photo", "Rain falling on a wet asphalt road reflecting streetlights", ["a small puddle forming", "a stray dog under a shop awning"]),
        ("p_0106", "photo", "A street food vendor flipping parathas on a large flat pan", ["a jar of green chilies on the cart", "steam rising in the cool air"]),
        # Family (3)
        ("p_0107", "photo", "Two elderly people sitting on a sofa looking at a smartphone", ["Nani is wearing glasses", "a cup of tea on the center table"]),
        ("p_0108", "photo", "A young boy playing with blocks on the living room rug", ["he built a small tower", "the TV is on in the background"]),
        ("p_0109", "photo", "A family gathered around a dining table laughing", ["someone is passing a bowl of rice", "Amma is wearing a green saree"]),
        # Screenshots/Documents (6)
        ("p_0110", "screenshot", "A screenshot of a WhatsApp conversation with a long message", ["the sender's name is Rohan", "the time sent is 11:45 PM"]),
        ("p_0111", "screenshot", "A screenshot of a Google Maps route showing a path to a restaurant", ["ETA is 45 minutes", "heavy traffic shown in red"]),
        ("p_0112", "document", "A scanned utility electricity bill on an official letterhead", ["amount due is Rs 1200", "billing month is July"]),
        ("p_0113", "document", "A PDF view of a flight boarding pass", ["flight number is 6E 403", "seat is 12A"]),
        ("p_0114", "document", "A handwritten doctor's prescription on a small notepad", ["prescribes Paracetamol and cough syrup", "doctor's signature at the bottom"]),
        ("p_0115", "document", "A printed bank statement summary page", ["ending balance is bolded", "a transaction for swiggy"]),
        # Wedding (2)
        ("p_0116", "photo", "A bride and groom standing on a decorated stage with floral garlands", ["the groom is looking away", "red roses in the background"]),
        ("p_0117", "photo", "Guests seated on chairs in a large tent watching a ceremony", ["Rohan is in the second row", "a kid running in the aisle"]),
        # Train (2)
        ("p_0118", "photo", "Looking out the window of a moving train at green fields", ["a small village in the distance", "reflection of the photographer in the glass"]),
        ("p_0119", "photo", "Two people sitting on train berths playing cards", ["Amit holds three cards", "a water bottle near the window"]),
        # Pets (2)
        ("p_0120", "photo", "A golden retriever sleeping on a rug with its paws stretched out", ["a chewed up toy nearby", "collar is blue"]),
        ("p_0121", "photo", "A stray cat sitting on top of a compound wall looking down", ["it has a white patch on its nose", "bougainvillea flowers hanging down"]),
        # Accidental (1)
        ("p_0122", "photo", "A blurry shot pointing mostly at a tiled floor and a shoe", ["the shoe is a black sneaker", "someone's shadow is cast on the floor"])
    ]

    for i, (id_, kind, scene, visible) in enumerate(standalones):
        records.append({
            "id": id_,
            "file": f"images/{id_}.jpg",
            "taken_at": f"20{18+(i%8)}-0{1+(i%9)}-1{1+(i%15)}T14:30:00+05:30",
            "place": None,
            "people": [random.choice(names_pool)] if kind == "photo" and i%2==0 else [],
            "kind": kind,
            "scene": scene,
            "visible_only_on_close_look": visible,
            "cluster": None,
            "near_identical": False,
            "opened_since_capture": (i % 2 == 0),
            "user_deposits": []
        })

    os.makedirs('data', exist_ok=True)
    with open('data/catalogue.json', 'w') as f:
        json.dump(records, f, indent=2)

    return records

def generate_images(records):
    os.makedirs('images', exist_ok=True)
    
    # Simple placeholder image generator
    # 1200x800 size
    width, height = 1200, 800
    
    for r in records:
        id_ = r["id"]
        filepath = r["file"]
        
        # Determine background color based on cluster or id
        if r["cluster"] == "c_hampi_cafe":
            bg_color = (255, 240, 200) # yellowish wall
        elif r["cluster"] == "c_laughing":
            bg_color = (200, 150, 150) # warm light
        elif r["cluster"] == "c_receipts":
            bg_color = (240, 240, 240) # white thermal
        elif r["cluster"] == "c_trek":
            bg_color = (150, 200, 150) # nature
        else:
            # Random pastel
            random.seed(id_)
            bg_color = (random.randint(200,255), random.randint(200,255), random.randint(200,255))
            
        img = Image.new('RGB', (width, height), color=bg_color)
        d = ImageDraw.Draw(img)
        
        # Attempt to load a default font, otherwise fall back
        try:
            # Might not be available on all systems, but ImageFont.load_default() is
            font = ImageFont.load_default()
        except:
            font = None
            
        text = f"{id_}\n{r['kind']}\n{r['scene'][:50]}..."
        
        # Simple text drawing
        # In a real app we'd compute text size and center it, but basic drawing is fine
        d.text((width//2 - 150, height//2), text, fill=(0,0,0), font=font)
        
        img.save(filepath, 'JPEG')

if __name__ == "__main__":
    recs = generate_catalogue()
    generate_images(recs)
    print(f"Generated {len(recs)} records and images.")
