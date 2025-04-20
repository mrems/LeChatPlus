/**
 * Applique un style à un élément HTML de manière sécurisée
 * @param element L'élément HTML à styler
 * @param property La propriété CSS à modifier
 * @param value La valeur à appliquer
 */
export function safeSetStyle(element: HTMLElement | null, property: string, value: string): void {
  if (element && element.style) {
    element.style[property as any] = value;
  }
}

/**
 * Injecte des styles CSS dans le document
 * @param styleContent Le contenu CSS à injecter
 * @param id Identifiant optionnel pour le style
 * @returns L'élément de style créé
 */
export function injectCSS(styleContent: string, id?: string): HTMLStyleElement {
  const styleElement = document.createElement('style');
  
  if (id) {
    styleElement.id = id;
  }
  
  styleElement.textContent = styleContent;
  document.head.appendChild(styleElement);
  
  return styleElement;
}

/**
 * Crée un élément HTML avec des propriétés et des styles
 * @param tag Type d'élément à créer
 * @param props Propriétés à appliquer à l'élément
 * @param styles Styles à appliquer à l'élément
 * @returns L'élément créé
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Record<string, string | EventListener>,
  styles?: Record<string, string>
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  
  if (props) {
    Object.entries(props).forEach(([key, value]) => {
      if (key.startsWith('on') && typeof value === 'function') {
        // Gestionnaire d'événements
        const eventName = key.substring(2).toLowerCase();
        element.addEventListener(eventName, value as EventListener);
      } else if (typeof value === 'string') {
        // Attribut
        if (key === 'className') {
          element.className = value;
        } else if (key === 'innerText') {
          element.innerText = value;
        } else if (key === 'innerHTML') {
          element.innerHTML = value;
        } else {
          element.setAttribute(key, value);
        }
      }
    });
  }
  
  if (styles) {
    Object.entries(styles).forEach(([property, value]) => {
      safeSetStyle(element, property, value);
    });
  }
  
  return element;
} 