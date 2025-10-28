/**
 * Utility function to conditionally join CSS class names
 * 
 * @param {...(string|Object|Array)} classes - Class names or objects/arrays of class names
 * @returns {string} Combined class names
 * 
 * @example
 * classNames('btn', 'btn-primary') // 'btn btn-primary'
 * classNames('btn', { 'btn-active': isActive }) // 'btn btn-active' if isActive
 * classNames(['btn', 'btn-primary']) // 'btn btn-primary'
 */
export function classNames(...classes) {
  return classes
    .flat()
    .filter(Boolean)
    .map((cls) => {
      if (typeof cls === 'string') return cls;
      if (typeof cls === 'object' && cls !== null) {
        return Object.keys(cls)
          .filter((key) => cls[key])
          .join(' ');
      }
      return '';
    })
    .join(' ')
    .trim();
}

export default classNames;

