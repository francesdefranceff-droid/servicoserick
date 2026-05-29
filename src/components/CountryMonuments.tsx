import brasil from "@/assets/monument-brasil.jpg";
import franca from "@/assets/monument-franca.jpg";
import portugal from "@/assets/monument-portugal.jpg";
import italia from "@/assets/monument-italia.jpg";
import suica from "@/assets/monument-suica.jpg";
import espanha from "@/assets/monument-espanha.jpg";

const COUNTRIES = [
  { country: "Brasil", monument: "Cristo Redentor", img: brasil },
  { country: "França", monument: "Torre Eiffel", img: franca },
  { country: "Portugal", monument: "Torre de Belém", img: portugal },
  { country: "Itália", monument: "Coliseu", img: italia },
  { country: "Suíça", monument: "Matterhorn", img: suica },
  { country: "Espanha", monument: "Sagrada Família", img: espanha },
];

export default function CountryMonuments() {
  return (
    <section className="max-w-7xl mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <h2 className="text-3xl sm:text-4xl font-bold mb-3">Conecte-se em qualquer país</h2>
        <p className="text-gray-600">Comunidades ativas nos principais destinos da diáspora</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {COUNTRIES.map((c) => (
          <div key={c.country} className="relative group rounded-2xl overflow-hidden shadow-md aspect-[3/4]">
            <img
              src={c.img}
              alt={`${c.monument} — ${c.country}`}
              loading="lazy"
              width={768}
              height={1024}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <h3 className="text-xl font-bold">{c.country}</h3>
              <p className="text-sm text-white/80">{c.monument}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}