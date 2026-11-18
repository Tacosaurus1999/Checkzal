import { moneda } from '../../utils/formato';

function Tarjeta({ titulo, valor, detalle, destacada = false }) {
  return (
    <div className={`h-100 p-3 ${destacada ? 'pms-card-vino' : 'pms-card'}`}>
      <p className={`pms-kicker mb-0 ${destacada ? 'pms-kicker-claro' : ''}`}>{titulo}</p>
      <p className="pms-cifra mt-2 mb-0" style={{ fontSize: '2.4rem' }}>{valor}</p>
      <p className={`small mt-2 mb-0 ${destacada ? 'pms-detalle-claro' : 'text-claro'}`}>{detalle}</p>
    </div>
  );
}

/** Totales del rango: reservas, llegadas, cancelaciones e ingresos. */
export default function ResumenEstadisticas({ totales }) {
  return (
    <section className="row g-3 mb-4">
      <div className="col-6 col-lg-3">
        <Tarjeta
          titulo="Personas que reservan"
          valor={totales.reservas}
          detalle={`reservas · ${totales.personas} persona(s) entre adultos y niños`}
        />
      </div>
      <div className="col-6 col-lg-3">
        <Tarjeta
          titulo="Sí llegaron"
          valor={totales.llegaron}
          detalle={`${totales.tasaLlegada}% de las reservas con desenlace · ${totales.porLlegar} por llegar`}
        />
      </div>
      <div className="col-6 col-lg-3">
        <Tarjeta
          titulo="Cancelaron"
          valor={totales.canceladas}
          detalle={`${totales.tasaCancelacion}% de las reservas con desenlace · ${totales.noShow} no se presentaron`}
        />
      </div>
      <div className="col-6 col-lg-3">
        <Tarjeta
          destacada
          titulo="Ingresos cobrados"
          valor={moneda(totales.ingresos)}
          detalle={`valor de reservas vigentes: ${moneda(totales.reservado)}`}
        />
      </div>
    </section>
  );
}
