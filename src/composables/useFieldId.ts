import { useId } from 'vue'

// Los átomos de formulario renderizan <label> y control como hermanos; sin un
// id compartido el lector de pantalla no anuncia el nombre del campo. Usamos
// useId() (único por instancia y estable en hidratación) y respetamos el id
// explícito del padre si es un string no vacío. Devuelve un getter que lee
// attrs.id en cada llamada para que un cambio posterior del atributo se refleje.
export function useFieldId(attrs: Readonly<Record<string, unknown>>): () => string {
  const generatedId = useId()

  return () => {
    const explicitId = attrs.id
    return typeof explicitId === 'string' && explicitId.trim() !== '' ? explicitId : generatedId
  }
}
