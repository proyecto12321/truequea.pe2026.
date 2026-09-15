-- ============================================================================
-- TRUEQUEA PE - Configuración de base de datos para Supabase
-- ============================================================================

-- Crear la tabla principal para almacenar los datos de Truequea PE
CREATE TABLE IF NOT EXISTS truequea_data (
    id INTEGER PRIMARY KEY DEFAULT 1,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    actualizado TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Asegurar que solo exista un registro (id = 1)
-- Esto permite upsert sin crear múltiples registros
CREATE OR REPLACE FUNCTION handle_truequea_data_upsert()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id IS NULL OR NEW.id != 1 THEN
        NEW.id := 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS truequea_data_id_trigger ON truequea_data;
CREATE TRIGGER truequea_data_id_trigger
    BEFORE INSERT ON truequea_data
    FOR EACH ROW
    EXECUTE FUNCTION handle_truequea_data_upsert();

-- Política de seguridad (RLS) - Permisos básicos
-- Para desarrollo: permitir lectura y escritura pública
-- Para producción: se debe restringir con autenticación

ALTER TABLE truequea_data ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura pública (desarrollo)
CREATE POLICY "Permitir lectura pública" ON truequea_data
    FOR SELECT USING (true);

-- Política para permitir escritura pública (desarrollo)
CREATE POLICY "Permitir escritura pública" ON truequea_data
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización pública" ON truequea_data
    FOR UPDATE USING (true);

-- Índice para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_truequea_data_actualizado ON truequea_data(actualizado DESC);

-- ============================================================================
-- Instrucciones de uso:
-- 1. Ve a tu proyecto en Supabase: https://supabase.com/dashboard
-- 2. Entra a SQL Editor (icono de >_ en el menú izquierdo)
-- 3. Crea un nuevo query y pega este script completo
-- 4. Ejecuta el script (botón "Run" en la esquina superior derecha)
-- 5. Verifica que la tabla 'truequea_data' se haya creado en Table Editor
-- 
-- Para producción, considera restringir los permisos usando autenticación:
-- - Habilita Authentication en Supabase
-- - Modifica las políticas RLS para usar auth.uid()
-- ============================================================================
