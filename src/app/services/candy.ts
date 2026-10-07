    import { Service } from '@angular/core';
    import { createClient, SupabaseClient } from '@supabase/supabase-js';
    import { environment } from '../../environments/environment';

    @Service()
    export class CandyService {
    private supabase: SupabaseClient;

    constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
    }

    async getProductos() {
    return await this.supabase.from('productos_candy').select('*');
    }

    async addProducto(producto: any) {
    const { data, error } = await this.supabase
        .from('productos_candy')
        .insert(producto)
        .select();

    if (error) {
        console.error('Error al insertar producto:', error);
        throw error;
    }
    return data;
    }

    async updateProducto(producto: any) {
    const { data, error } = await this.supabase
        .from('productos_candy')
        .update(producto)
        .eq('id', producto.id)
        .select();

    if (error) {
        console.error('Error al actualizar producto:', error);
        throw error;
    }
    return data;
    }

    async deleteProducto(id: string) {
    const { data, error } = await this.supabase
        .from('productos_candy')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error al eliminar producto:', error.message);
        // 23503 = el producto ya se vendió alguna vez (compra_items lo referencia)
        if (error.code === '23503') {
            throw new Error('No se puede eliminar: el producto ya se vendió en alguna compra.');
        }
        throw new Error(error.message);
    }
    return data;
    }
    }