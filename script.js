const URL_GATOS = "https://api.thecatapi.com/v1/images/search";
const CLAVE_GUARDADO = "petcare_estado_v1";
 
const VETERINARIOS = [
    { id: "ramirez", nombre: "Dr. Ramírez", especialidad: "Clínica general",
      detalle: "Controles, vacunas, desparasitación y todo lo de todos los días." },
    { id: "lopez", nombre: "Dra. López", especialidad: "Dermatología",
      detalle: "Picazón, alergias, hongos y problemas de piel o pelo." },
    { id: "gomez", nombre: "Dr. Gómez", especialidad: "Cirugía",
      detalle: "Castraciones, cirugías programadas y controles posteriores." }
];
 
const ESPECIES = ["Perro", "Gato", "Conejo", "Ave", "Otra"];
 
// franjas de atención por día de la semana (0 = domingo)
const FRANJAS = {
    0: [],
    1: [[9, 13], [15, 19]],
    2: [[9, 13], [15, 19]],
    3: [[9, 13], [15, 19]],
    4: [[9, 13], [15, 19]],
    5: [[9, 13], [15, 19]],
    6: [[9, 13]]
};
 
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
 
 
// ---------- Funciones auxiliares (sin Vue) ----------
function pad(n) {
    return String(n).padStart(2, "0");
}
 
function fecha_a_iso(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
 
function hoy_iso() {
    return fecha_a_iso(new Date());
}
 
function formatear_fecha(iso) {
    let partes = iso.split("-");
    return partes[2] + "/" + partes[1] + "/" + partes[0];
}
 
function dia_de_semana(iso) {
    return new Date(iso + "T00:00:00").getDay();
}
 
function numero_turno(n) {
    return String(n).padStart(4, "0");
}
 
// primer día hábil a partir de "desde" días (para los datos de ejemplo)
function dia_habil(desde) {
    let d = new Date();
    d.setDate(d.getDate() + desde);
    while (d.getDay() === 0) {
        d.setDate(d.getDate() + 1);
    }
    return fecha_a_iso(d);
}
 
function horarios_del_dia(iso) {
    let horas = [];
    if (!iso) return horas;
    FRANJAS[dia_de_semana(iso)].forEach(franja => {
        for (let h = franja[0]; h < franja[1]; h++) {
            horas.push(pad(h) + ":00");
            horas.push(pad(h) + ":30");
        }
    });
    return horas;
}
 
function buscar_vet(id) {
    return VETERINARIOS.find(v => v.id === id);
}
 
function ticket_vacio(numero) {
    return { numero: numero, mascota: "", dueno: "", vet: "", cuando: "", motivo: "", reservado: false };
}
 
 
let appVue2 = new Vue({
    el: "#app",
    data: {
        veterinarios: VETERINARIOS,
        especies: ESPECIES,
 
        // "base de datos" en memoria
        clientes: [],
        mascotas: [],
        turnos: [],
        siguiente_id: 1,
        siguiente_turno: 1,
 
        // campos del formulario
        nombre: "",
        dni: "",
        email: "",
        telefono: "",
        mascota: "",
        especie: "",
        edad: "",
        veterinario: "",
        fecha: "",
        hora: "",
        motivo: "",
        fecha_min: "",
        fecha_max: "",
        errores: {
            nombre: "", dni: "", email: "", telefono: "", mascota: "", especie: "",
            edad: "", veterinario: "", fecha: "", hora: "", motivo: ""
        },
        mensaje: "",
        mensaje_tipo: "",
 
        // tarjetas de turno
        ticket_form: ticket_vacio("0001"),
        ticket_hero: ticket_vacio("0001"),
 
        // agenda
        filtro_vet: "",
        buscar: "",
 
        // gato al azar
        gato_url: "",
        gato_mensaje: "",
        gato_cargando: false,
 
        // horario del local
        local_texto: "",
        local_abierto: false,
 
        anio: new Date().getFullYear()
    },
    created: function() {
        this.cargar_estado();
        this.fecha_min = hoy_iso();
        let tope = new Date();
        tope.setDate(tope.getDate() + 90);
        this.fecha_max = fecha_a_iso(tope);
        this.actualizar_ticket();
        this.actualizar_hero();
        this.calcular_estado_local();
        this.traer_gato();
    },
    methods: {
 
        // ---------- Guardado en el navegador ----------
        guardar_estado: function() {
            try {
                localStorage.setItem(CLAVE_GUARDADO, JSON.stringify({
                    clientes: this.clientes,
                    mascotas: this.mascotas,
                    turnos: this.turnos,
                    siguiente_id: this.siguiente_id,
                    siguiente_turno: this.siguiente_turno
                }));
            } catch (e) {
                // si el navegador no deja guardar, la página sigue funcionando igual
            }
        },
        cargar_estado: function() {
            try {
                let guardado = localStorage.getItem(CLAVE_GUARDADO);
                if (guardado) {
                    let datos = JSON.parse(guardado);
                    this.clientes = datos.clientes;
                    this.mascotas = datos.mascotas;
                    this.turnos = datos.turnos;
                    this.siguiente_id = datos.siguiente_id;
                    this.siguiente_turno = datos.siguiente_turno;
                    return;
                }
            } catch (e) {
                // seguimos con los datos de ejemplo
            }
            this.cargar_ejemplos();
        },
        // unos turnos de ejemplo para que la agenda no arranque vacía
        cargar_ejemplos: function() {
            this.clientes = [
                { id: 1, nombre: "Lucía Fernández", dni: "32145678", email: "", telefono: "" },
                { id: 2, nombre: "Martín Acosta", dni: "28456123", email: "", telefono: "" },
                { id: 3, nombre: "Carolina Suárez", dni: "35678901", email: "", telefono: "" }
            ];
            this.mascotas = [
                { id: 4, nombre: "Mora", especie: "Perro", edad: 4, dueno_id: 1 },
                { id: 5, nombre: "Tito", especie: "Gato", edad: 7, dueno_id: 2 },
                { id: 6, nombre: "Pochoclo", especie: "Conejo", edad: 2, dueno_id: 3 }
            ];
            this.turnos = [
                { id: 1, mascota_id: 4, veterinario_id: "ramirez", fecha: dia_habil(1), hora: "10:00", motivo: "Vacuna anual" },
                { id: 2, mascota_id: 5, veterinario_id: "lopez", fecha: dia_habil(2), hora: "15:30", motivo: "Se rasca mucho una oreja" },
                { id: 3, mascota_id: 6, veterinario_id: "gomez", fecha: dia_habil(3), hora: "11:00", motivo: "Control después de la castración" }
            ];
            this.siguiente_id = 7;
            this.siguiente_turno = 4;
            this.guardar_estado();
        },
        nuevo_id: function() {
            return this.siguiente_id++;
        },
 
        // ---------- Tarjetas de turno ----------
        texto_cuando: function(fecha, hora) {
            if (!fecha) return "";
            let base = DIAS[dia_de_semana(fecha)] + " " + formatear_fecha(fecha);
            return hora ? base + ", " + hora + " h" : base;
        },
        datos_de_turno: function(turno) {
            let masc = this.mascotas.find(m => m.id === turno.mascota_id);
            let dueno = this.clientes.find(c => c.id === masc.dueno_id);
            return {
                numero: numero_turno(turno.id),
                mascota: masc.nombre,
                dueno: dueno.nombre,
                vet: buscar_vet(turno.veterinario_id).nombre,
                cuando: this.texto_cuando(turno.fecha, turno.hora),
                motivo: turno.motivo,
                reservado: false
            };
        },
        // la tarjeta del formulario se va escribiendo mientras completás los campos
        actualizar_ticket: function(evento) {
            // En un <select> el navegador dispara "input" y después "change", pero v-model
            // recién guarda el valor en "change". Si redibujáramos en "input", Vue pisaría
            // la opción elegida con el valor viejo. Por eso los select se actualizan solo en "change".
            if (evento && evento.type === "input" && evento.target.tagName === "SELECT") return;
            let vet = buscar_vet(this.veterinario);
            this.ticket_form = {
                numero: numero_turno(this.siguiente_turno),
                mascota: this.mascota.trim(),
                dueno: this.nombre.trim(),
                vet: vet ? vet.nombre : "",
                cuando: this.texto_cuando(this.fecha, this.hora),
                motivo: this.motivo.trim(),
                reservado: false
            };
        },
        // la tarjeta del inicio muestra el próximo turno de la agenda
        actualizar_hero: function() {
            let hoy = hoy_iso();
            let proximo = this.turnos_ordenados().find(t => t.fecha >= hoy);
            this.ticket_hero = proximo ? this.datos_de_turno(proximo) : ticket_vacio(numero_turno(this.siguiente_turno));
        },
 
        // ---------- Veterinarios y horarios ----------
        elegir_veterinario: function(id) {
            this.veterinario = id;
            this.hora = "";
            this.actualizar_ticket();
            document.getElementById("turno").scrollIntoView();
            document.getElementById("nombre").focus({ preventScroll: true });
        },
        hora_habilitada: function() {
            return this.veterinario !== "" && this.fecha !== "" && horarios_del_dia(this.fecha).length > 0;
        },
        texto_hora_vacia: function() {
            if (this.veterinario === "") return "Elegí vet.";
            if (this.fecha === "") return "Elegí día";
            if (horarios_del_dia(this.fecha).length === 0) return "Sin atención";
            return "Elegí hora";
        },
        // horas del día elegido, marcando las que ese veterinario ya tiene ocupadas
        opciones_hora: function() {
            if (!this.hora_habilitada()) return [];
            let ahora = new Date();
            let hora_actual = pad(ahora.getHours()) + ":" + pad(ahora.getMinutes());
            let es_hoy = this.fecha === hoy_iso();
            let opciones = [];
            horarios_del_dia(this.fecha).forEach(h => {
                if (es_hoy && h <= hora_actual) return;
                opciones.push({ valor: h, ocupada: this.horario_ocupado(this.veterinario, this.fecha, h) });
            });
            return opciones;
        },
        horario_ocupado: function(vet_id, fecha, hora) {
            return this.turnos.some(t => t.veterinario_id === vet_id && t.fecha === fecha && t.hora === hora);
        },
 
        // ---------- Validación y reserva ----------
        limpiar_errores: function() {
            for (let campo in this.errores) {
                this.errores[campo] = "";
            }
            this.mensaje = "";
            this.mensaje_tipo = "";
        },
        // devuelve el primer campo con error ("" si está todo bien)
        validar: function() {
            let e = this.errores;
            let edad = Number(this.edad);
 
            if (this.nombre.trim().length < 3) e.nombre = "Escribí tu nombre y apellido.";
            if (!/^\d{7,8}$/.test(this.dni.trim())) e.dni = "El DNI tiene 7 u 8 números, sin puntos.";
            if (this.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())) e.email = "Ese email no parece válido.";
            if (this.telefono.trim() && this.telefono.replace(/\D/g, "").length < 8) e.telefono = "Poné el teléfono con característica.";
 
            if (this.mascota.trim().length < 2) e.mascota = "Escribí el nombre de tu mascota.";
            if (!this.especie) e.especie = "Elegí la especie.";
            if (this.edad === "" || !Number.isInteger(edad) || edad < 0 || edad > 30) e.edad = "Poné una edad entre 0 y 30.";
 
            if (!this.veterinario) e.veterinario = "Elegí con quién querés atenderte.";
            if (!this.fecha) {
                e.fecha = "Elegí un día.";
            } else if (this.fecha < hoy_iso()) {
                e.fecha = "Ese día ya pasó.";
            } else if (dia_de_semana(this.fecha) === 0) {
                e.fecha = "Los domingos no atendemos.";
            }
            if (!this.hora) e.hora = "Elegí un horario.";
            if (this.motivo.trim().length < 3) e.motivo = "Contanos brevemente por qué venís.";
 
            let orden = ["nombre", "dni", "email", "telefono", "mascota", "especie", "edad", "veterinario", "fecha", "hora", "motivo"];
            return orden.find(campo => e[campo] !== "") || "";
        },
        reservar_turno: function() {
            this.limpiar_errores();
 
            let primero = this.validar();
            if (primero) {
                this.mensaje = "Revisá los campos marcados.";
                this.mensaje_tipo = "mal";
                document.getElementById(primero).focus();
                return;
            }
 
            if (this.horario_ocupado(this.veterinario, this.fecha, this.hora)) {
                this.errores.hora = "Ese veterinario ya tiene un turno en ese horario.";
                this.hora = "";
                return;
            }
 
            // cliente: si el DNI ya existe lo reutilizamos
            let cliente = this.clientes.find(c => c.dni === this.dni.trim());
            let cliente_nuevo = false;
            if (!cliente) {
                cliente = { id: this.nuevo_id(), nombre: this.nombre.trim(), dni: this.dni.trim(),
                            email: this.email.trim(), telefono: this.telefono.trim() };
                this.clientes.push(cliente);
                cliente_nuevo = true;
            } else {
                cliente.email = this.email.trim() || cliente.email;
                cliente.telefono = this.telefono.trim() || cliente.telefono;
            }
 
            // mascota: si ese dueño ya tiene una con ese nombre la reutilizamos
            let nombre_mascota = this.mascota.trim();
            let masc = this.mascotas.find(m => m.dueno_id === cliente.id && m.nombre.toLowerCase() === nombre_mascota.toLowerCase());
            if (!masc) {
                masc = { id: this.nuevo_id(), nombre: nombre_mascota, especie: this.especie, edad: Number(this.edad), dueno_id: cliente.id };
                this.mascotas.push(masc);
            }
 
            let turno = {
                id: this.siguiente_turno++,
                mascota_id: masc.id,
                veterinario_id: this.veterinario,
                fecha: this.fecha,
                hora: this.hora,
                motivo: this.motivo.trim()
            };
            this.turnos.push(turno);
            this.guardar_estado();
 
            // confirmación: la tarjeta queda sellada con lo que se reservó
            let resumen = this.datos_de_turno(turno);
            resumen.reservado = true;
            this.ticket_form = resumen;
 
            let saludo = cliente_nuevo ? "" : cliente.nombre.split(" ")[0] + ", ya te teníamos en el sistema. ";
            this.mensaje = saludo + "Turno Nº " + resumen.numero + " reservado para " + resumen.mascota + ", " + resumen.cuando + ".";
            this.mensaje_tipo = "ok";
 
            this.nombre = "";
            this.dni = "";
            this.email = "";
            this.telefono = "";
            this.mascota = "";
            this.especie = "";
            this.edad = "";
            this.veterinario = "";
            this.fecha = "";
            this.hora = "";
            this.motivo = "";
 
            this.actualizar_hero();
        },
 
        // ---------- Agenda ----------
        turnos_ordenados: function() {
            return this.turnos.slice().sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
        },
        // turnos que pasan el filtro, ya con los textos listos para la tabla
        turnos_visibles: function() {
            let texto = this.buscar.trim().toLowerCase();
            let hoy = hoy_iso();
            let lista = [];
            this.turnos_ordenados().forEach(t => {
                if (this.filtro_vet && t.veterinario_id !== this.filtro_vet) return;
                let masc = this.mascotas.find(m => m.id === t.mascota_id);
                let d = this.datos_de_turno(t);
                if (texto && !d.mascota.toLowerCase().includes(texto) && !d.dueno.toLowerCase().includes(texto)) return;
                lista.push({
                    id: t.id,
                    fecha_texto: formatear_fecha(t.fecha),
                    hora: t.hora,
                    dia: DIAS[dia_de_semana(t.fecha)],
                    mascota: d.mascota,
                    detalle_mascota: masc.especie + ", " + masc.edad + (masc.edad === 1 ? " año" : " años"),
                    dueno: d.dueno,
                    vet: d.vet,
                    motivo: d.motivo,
                    pasado: t.fecha < hoy
                });
            });
            return lista;
        },
        contador_texto: function() {
            let n = this.turnos_visibles().length;
            return n === 1 ? "1 turno en la lista" : n + " turnos en la lista";
        },
        texto_vacio: function() {
            return this.turnos.length === 0
                ? "Todavía no hay turnos. El primero puede ser el tuyo."
                : "No hay turnos con ese filtro.";
        },
        cancelar_turno: function(id) {
            let turno = this.turnos.find(t => t.id === id);
            let d = this.datos_de_turno(turno);
            if (!confirm("¿Cancelar el turno de " + d.mascota + " del " + d.cuando + "?")) return;
            this.turnos = this.turnos.filter(t => t.id !== id);
            this.guardar_estado();
            this.actualizar_hero();
        },
 
        // ---------- Horario del local ----------
        calcular_estado_local: function() {
            let ahora = new Date();
            let minutos = ahora.getHours() * 60 + ahora.getMinutes();
            let hoy = ahora.getDay();
            this.local_abierto = false;
 
            for (let franja of FRANJAS[hoy]) {
                if (minutos >= franja[0] * 60 && minutos < franja[1] * 60) {
                    this.local_abierto = true;
                    this.local_texto = "Estamos atendiendo. Esta tanda cierra a las " + pad(franja[1]) + ":00.";
                    return;
                }
            }
 
            let proxima = FRANJAS[hoy].find(franja => minutos < franja[0] * 60);
            if (proxima) {
                this.local_texto = "Ahora estamos cerrados. Hoy volvemos a las " + pad(proxima[0]) + ":00.";
                return;
            }
 
            for (let i = 1; i <= 7; i++) {
                let franjas = FRANJAS[(hoy + i) % 7];
                if (franjas.length > 0) {
                    let cuando = i === 1 ? "mañana" : "el " + DIAS[(hoy + i) % 7];
                    this.local_texto = "Ahora estamos cerrados. Abrimos " + cuando + " a las " + pad(franjas[0][0]) + ":00.";
                    return;
                }
            }
        },
 
        // ---------- Gato al azar (API externa con axios) ----------
        traer_gato: function() {
            this.gato_cargando = true;
            this.gato_mensaje = "Buscando un gato...";
            axios.get(URL_GATOS)
                .then(response => {
                    this.gato_url = response.data[0].url;
                    this.gato_mensaje = "";
                    this.gato_cargando = false;
                })
                .catch(error => {
                    this.gato_mensaje = "No pudimos traer un gato ahora. Probá de nuevo en un rato.";
                    this.gato_cargando = false;
                });
        }
    }
});
