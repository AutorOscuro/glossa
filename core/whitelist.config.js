// @purpose: Configuración de la lista blanca (1.11-T2): umbral de dominio de un tema y lista base A1 de lemas que se dan por conocidos desde el primer día.
// Solo datos. El umbral es PROVISIONAL (lo confirma William al probar la 5.2). Cada lema de A1_BASE debe existir en content/taxonomy/lemmas.json (lo comprueba una prueba).
export const KNOWN_TOPIC_THRESHOLD = 60; // pct de dominio (mastery.compute) desde el que los ítems de un tema cuentan como sabidos: banda «Sólido»

// Rango de comprensibilidad objetivo (principio 90–95 %, roadmap 7.9): fracciones de 0 a 1, ambos extremos incluidos. Lo usa `isWithinTarget`.
export const TARGET_RANGE = Object.freeze({ min: 0.90, max: 0.95 });

export const A1_BASE = Object.freeze([
  // pronombres y determinantes
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'this', 'that', 'a', 'an', 'the', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
  'some', 'any', 'no', 'all', 'every', 'each', 'other', 'another', 'who', 'what', 'where', 'when', 'why', 'how', 'which',
  // verbos básicos
  'be', 'have', 'do', 'go', 'come', 'get', 'make', 'take', 'give', 'see', 'look', 'want', 'like', 'love', 'know', 'think', 'say', 'tell', 'ask',
  'eat', 'drink', 'live', 'work', 'play', 'help', 'need', 'use', 'try', 'call', 'open', 'close', 'start', 'stop', 'read', 'write', 'speak', 'talk',
  'listen', 'hear', 'buy', 'sell', 'sleep', 'walk', 'run', 'sit', 'stand', 'wait', 'learn', 'study', 'teach', 'meet', 'find', 'put', 'bring', 'leave',
  // preposiciones, conjunciones y adverbios
  'in', 'on', 'at', 'to', 'from', 'with', 'for', 'of', 'by', 'about', 'under', 'over', 'up', 'down', 'out', 'into', 'near', 'after', 'before',
  'and', 'but', 'or', 'because', 'if', 'so', 'not', 'very', 'too', 'also', 'here', 'there', 'now', 'then', 'today', 'tomorrow', 'yesterday', 'always',
  'never', 'often', 'sometimes', 'again', 'only', 'just', 'much', 'many', 'more', 'please', 'yes', 'ok',
  // adjetivos
  'good', 'bad', 'big', 'small', 'new', 'old', 'young', 'happy', 'sad', 'hot', 'cold', 'easy', 'hard', 'right', 'wrong', 'long', 'short', 'tall',
  'fast', 'slow', 'nice', 'beautiful', 'tired', 'hungry', 'ready', 'free', 'same', 'different', 'first', 'last', 'next',
  // números, tiempo y días
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'hundred', 'thousand', 'zero',
  'day', 'week', 'month', 'year', 'time', 'morning', 'afternoon', 'evening', 'night', 'hour', 'minute',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  // personas, lugares y cosas
  'man', 'woman', 'boy', 'girl', 'child', 'baby', 'friend', 'family', 'mother', 'father', 'brother', 'sister', 'son', 'daughter', 'name', 'person',
  'people', 'teacher', 'student', 'house', 'home', 'room', 'school', 'city', 'street', 'shop', 'store', 'office', 'car', 'bus', 'train', 'book',
  'phone', 'door', 'table', 'chair', 'bed', 'water', 'food', 'bread', 'milk', 'coffee', 'tea', 'fruit', 'apple', 'money', 'job', 'dog', 'cat', 'color',
  'red', 'blue', 'green', 'black', 'white', 'world', 'country', 'thing', 'word', 'question', 'answer', 'life', 'hand', 'head', 'eye',
]);
