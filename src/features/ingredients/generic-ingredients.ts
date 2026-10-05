import { ingredientNameKey } from '@/features/ingredients/parse-ingredient-line';

/**
 * Names too general to shop for ("onion", "rice", "beans"). A line or item
 * with one of these always asks which kind she means, offering her own more
 * specific ingredients first and then these common choices.
 */
const GENERIC: Record<string, string[]> = {
  onion: ['yellow onion', 'red onion', 'white onion', 'sweet onion', 'green onions', 'shallots'],
  rice: ['long-grain white rice', 'jasmine rice', 'basmati rice', 'brown rice', 'Calrose rice'],
  beans: [
    'black beans',
    'pinto beans',
    'kidney beans',
    'cannellini beans',
    'garbanzo beans',
    'refried beans',
    'green beans',
  ],
  cheese: [
    'cheddar cheese',
    'Monterey Jack cheese',
    'mozzarella cheese',
    'Parmesan cheese',
    'Colby Jack cheese',
    'cream cheese',
  ],
  chicken: [
    'boneless skinless chicken breasts',
    'chicken thighs',
    'chicken tenderloins',
    'ground chicken',
    'rotisserie chicken',
  ],
  beef: ['ground beef', 'chuck roast', 'stew meat', 'flank steak', 'sirloin steak'],
  pork: ['pork chops', 'pork tenderloin', 'pork shoulder', 'ground pork'],
  sausage: ['Italian sausage', 'breakfast sausage', 'smoked sausage', 'chorizo'],
  fish: ['salmon', 'tilapia', 'cod', 'canned tuna'],
  pasta: ['spaghetti', 'penne', 'rotini', 'elbow macaroni', 'fettuccine', 'lasagna noodles'],
  noodles: ['egg noodles', 'lasagna noodles', 'ramen noodles', 'rice noodles'],
  flour: ['all-purpose flour', 'bread flour', 'whole wheat flour'],
  sugar: ['granulated sugar', 'brown sugar', 'powdered sugar'],
  milk: ['whole milk', '2% milk', 'skim milk', 'buttermilk'],
  cream: ['heavy cream', 'sour cream', 'half-and-half', 'whipping cream'],
  yogurt: ['plain Greek yogurt', 'plain yogurt', 'vanilla yogurt'],
  butter: ['salted butter', 'unsalted butter'],
  oil: ['olive oil', 'vegetable oil', 'canola oil', 'coconut oil', 'sesame oil'],
  vinegar: [
    'white vinegar',
    'apple cider vinegar',
    'red wine vinegar',
    'rice vinegar',
    'balsamic vinegar',
  ],
  broth: ['chicken broth', 'beef broth', 'vegetable broth'],
  stock: ['chicken stock', 'beef stock', 'vegetable stock'],
  tomatoes: ['roma tomatoes', 'cherry tomatoes', 'diced tomatoes', 'crushed tomatoes'],
  pepper: ['black pepper', 'green bell pepper', 'red bell pepper', 'jalapeños'],
  peppers: ['green bell peppers', 'red bell peppers', 'jalapeños', 'poblano peppers'],
  potatoes: ['russet potatoes', 'red potatoes', 'Yukon Gold potatoes', 'sweet potatoes'],
  lettuce: ['romaine lettuce', 'iceberg lettuce', 'spring mix'],
  squash: ['zucchini', 'yellow squash', 'butternut squash', 'spaghetti squash'],
  cabbage: ['green cabbage', 'red cabbage', 'napa cabbage'],
  mushrooms: ['white mushrooms', 'cremini mushrooms', 'portobello mushrooms'],
  corn: ['frozen corn', 'canned corn', 'corn on the cob'],
  peas: ['frozen peas', 'snap peas', 'snow peas'],
  apples: ['Gala apples', 'Granny Smith apples', 'Honeycrisp apples', 'Fuji apples'],
  berries: ['strawberries', 'blueberries', 'raspberries', 'blackberries'],
  lentils: ['red lentils', 'green lentils', 'brown lentils'],
  nuts: ['almonds', 'walnuts', 'pecans', 'peanuts', 'cashews'],
  bread: ['sandwich bread', 'French bread', 'hamburger buns', 'dinner rolls'],
  tortillas: ['flour tortillas', 'corn tortillas'],
  salsa: ['mild salsa', 'medium salsa', 'salsa verde'],
  mustard: ['yellow mustard', 'Dijon mustard', 'ground mustard'],
  chocolate: ['chocolate chips', 'semi-sweet baking chocolate', 'cocoa powder'],
};

// Keyed by the matching key, so "Onions", "onion", and "ONION" all count.
const BY_KEY = new Map(
  Object.entries(GENERIC).map(([name, options]) => [ingredientNameKey(name), options])
);

/** Common specific kinds when the name is too general to shop for, else null. */
export function specificOptions(name: string): string[] | null {
  return BY_KEY.get(ingredientNameKey(name)) ?? null;
}
