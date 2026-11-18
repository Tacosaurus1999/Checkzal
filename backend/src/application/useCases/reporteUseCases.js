'use strict';

/**
 * Caso de uso: GetDashboardSummary (Read)
 * Combina las vistas v_ocupacion_hoy y v_movimientos_hoy en un solo payload
 * para el panel de operaciones del día.
 */
class GetDashboardSummary {
  /** @param {import('../ports/repositories').ReporteRepositoryPort} reporteRepository */
  constructor(reporteRepository) {
    this.reporteRepository = reporteRepository;
  }

  async ejecutar(hotelId) {
    const [ocupacion, movimientos] = await Promise.all([
      this.reporteRepository.ocupacionHoy(hotelId),
      this.reporteRepository.movimientosHoy(hotelId),
    ]);

    return {
      ocupacion,
      llegadas: movimientos.filter((m) => m.movimiento === 'llegada'),
      salidas: movimientos.filter((m) => m.movimiento === 'salida'),
    };
  }
}

const { DomainError } = require('../../domain/errors/DomainError');
const { hoyNegocio } = require('../utils/fechas');

const UNIDADES = { semana: 'week', mes: 'month', anio: 'year' };
const MAX_PERIODOS = 120;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const aISO = (d) => d.toISOString().slice(0, 10);
const aFecha = (iso) => new Date(`${iso}T00:00:00Z`);


/** Inicio del periodo (lunes / día 1 del mes / 1 de enero) que contiene la fecha. */
function inicioPeriodo(unidad, iso) {
  const d = aFecha(iso);
  if (unidad === 'week') d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  else if (unidad === 'month') d.setUTCDate(1);
  else d.setUTCMonth(0, 1);
  return aISO(d);
}

function sumarPeriodos(unidad, iso, n) {
  const d = aFecha(iso);
  if (unidad === 'week') d.setUTCDate(d.getUTCDate() + 7 * n);
  else if (unidad === 'month') d.setUTCMonth(d.getUTCMonth() + n);
  else d.setUTCFullYear(d.getUTCFullYear() + n);
  return aISO(d);
}

/** Ventana por defecto: periodos hacia atrás + algunos hacia adelante (para ver reservas futuras). */
const VENTANA = { week: { atras: 11, adelante: 4 }, month: { atras: 11, adelante: 2 }, year: { atras: 4, adelante: 1 } };

function dividir(a, b) {
  return b > 0 ? Math.round((a / b) * 1000) / 10 : 0;
}

/**
 * Caso de uso: GetStatistics (Read) — SOLO administrador (se exige también en la ruta).
 * Reservas, personas, llegadas, cancelaciones e ingresos por semana, mes o año.
 */
class GetStatistics {
  /** @param {import('../ports/repositories').ReporteRepositoryPort} reporteRepository */
  constructor(reporteRepository, { hoy = hoyNegocio } = {}) {
    this.reporteRepository = reporteRepository;
    this.hoy = hoy;
  }

  async ejecutar(hotelId, { granularidad = 'mes', desde, hasta } = {}) {
    const unidad = UNIDADES[granularidad];
    if (!unidad) throw new DomainError('La granularidad debe ser semana, mes o anio.', 'VALIDACION');
    for (const [nombre, valor] of [['desde', desde], ['hasta', hasta]]) {
      const valida = (v) => ISO.test(v) && !Number.isNaN(aFecha(v).getTime()) && aISO(aFecha(v)) === v;
      if (valor && !valida(valor)) {
        throw new DomainError(`La fecha "${nombre}" debe tener formato YYYY-MM-DD.`, 'VALIDACION');
      }
    }

    const actual = inicioPeriodo(unidad, this.hoy());
    const inicio = desde || sumarPeriodos(unidad, actual, -VENTANA[unidad].atras);
    const fin = hasta || sumarPeriodos(unidad, actual, VENTANA[unidad].adelante + 1); // primer día del siguiente
    const finInclusivo = hasta || aISO(new Date(aFecha(fin).getTime() - 86400000));

    if (finInclusivo < inicio) throw new DomainError('"hasta" no puede ser anterior a "desde".', 'VALIDACION');
    const periodos = [];
    for (let p = inicioPeriodo(unidad, inicio); p <= finInclusivo && periodos.length <= MAX_PERIODOS; p = sumarPeriodos(unidad, p, 1)) {
      periodos.push(p);
    }
    if (periodos.length > MAX_PERIODOS) {
      throw new DomainError(`El rango es demasiado grande (máximo ${MAX_PERIODOS} periodos).`, 'VALIDACION');
    }

    const serie = await this.reporteRepository.estadisticas(hotelId, { unidad, desde: inicio, hasta: finInclusivo });

    const suma = (campo) => serie.reduce((acc, fila) => acc + fila[campo], 0);
    const totales = {
      reservas: suma('reservas'),
      personas: suma('personas'),
      llegaron: suma('llegaron'),
      canceladas: suma('canceladas'),
      noShow: suma('noShow'),
      porLlegar: suma('porLlegar'),
      reservado: suma('reservado'),
      ingresos: suma('ingresos'),
    };
    // Los huéspedes únicos solo se informan por periodo (no se pueden sumar sin duplicar personas).
    // Tasas sobre reservas cuyo desenlace ya se conoce (llegaron + canceladas + no_show).
    const resueltas = totales.llegaron + totales.canceladas + totales.noShow;
    totales.tasaLlegada = dividir(totales.llegaron, resueltas);
    totales.tasaCancelacion = dividir(totales.canceladas, resueltas);

    return {
      granularidad,
      desde: inicio,
      hasta: finInclusivo,
      periodoActual: actual,
      totales,
      serie,
    };
  }
}

module.exports = { GetDashboardSummary, GetStatistics, inicioPeriodo, sumarPeriodos };
