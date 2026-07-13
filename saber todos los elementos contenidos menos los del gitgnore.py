import os
import pathspec

def cargar_gitignore(directorio_base):
    gitignore_path = os.path.join(directorio_base, ".gitignore")
    if not os.path.exists(gitignore_path):
        return pathspec.PathSpec.from_lines("gitwildmatch", [])
    
    with open(gitignore_path, "r") as f:
        lineas = f.readlines()
    return pathspec.PathSpec.from_lines("gitwildmatch", lineas)

def listar_archivos_filtrados(directorio_base):
    spec = cargar_gitignore(directorio_base)
    archivos_validos = []

    for carpeta_actual, subcarpetas, archivos in os.walk(directorio_base):
        # Excluir carpetas ignoradas
        subcarpetas[:] = [
            d for d in subcarpetas
            if not spec.match_file(os.path.relpath(os.path.join(carpeta_actual, d), directorio_base))
        ]

        for archivo in archivos:
            ruta_absoluta = os.path.join(carpeta_actual, archivo)
            ruta_relativa = os.path.relpath(ruta_absoluta, directorio_base)
            ruta_relativa_unix = ruta_relativa.replace("\\", "/")

            if not spec.match_file(ruta_relativa_unix):
                profundidad = ruta_relativa_unix.count("/")
                archivos_validos.append((profundidad, ruta_relativa_unix))

    # Ordenar por profundidad (de menos a más profunda)
    archivos_validos.sort(key=lambda x: x[0])

    for _, ruta in archivos_validos:
        print(ruta)

if __name__ == "__main__":
    directorio_base = "."  # Directorio raíz del repo
    listar_archivos_filtrados(directorio_base)
