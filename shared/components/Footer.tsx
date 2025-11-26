import Link from "next/link";
// Importamos los íconos de Lucide
import { MapPin, Phone, Mail, Facebook, Instagram } from "lucide-react";

export const Footer = () => {
  return (
    // Usamos 'bg-foreground' y texto claro como en tu original
    <footer className="bg-foreground text-gray-300 rounded-t-4xl mt-auto">
      <div className="w-full max-w-7xl mx-auto p-8 md:py-12">
        
        {/* Sección Superior - Grilla de 4 columnas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
          
          {/* 1. Logo/Nombre */}
          <div>
            <Link href="/" className="flex items-center space-x-3">
              <span className="text-white self-center text-2xl font-semibold whitespace-nowrap">
                TerraNova
              </span>
            </Link>
            <p className="mt-4 text-sm text-gray-400">
              Tu socio ideal para encontrar el hogar de tus sueños.
            </p>
          </div>

          {/* 2. Navegación */}
          <div>
            <h3 className="text-md font-semibold text-white uppercase mb-4">Navegación</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/propiedades" className="text-gray-400 hover:underline hover:text-white">
                  Propiedades
                </Link>
              </li>
              <li>
                <Link href="/contacto" className="text-gray-400 hover:underline hover:text-white">
                  Contacto
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-gray-400 hover:underline hover:text-white">
                  Ingresar
                </Link>
              </li>
            </ul>
          </div>

          {/* 3. Contacto */}
          <div>
            <h3 className="text-md font-semibold text-white uppercase mb-4">Contacto</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start">
                <MapPin size={16} className="mr-2 mt-1 shrink-0" />
                <span className="text-gray-400">Gobernador Crespo 1658, Tostado, Santa Fe</span>
              </li>
              <li className="flex items-center">
                <Phone size={16} className="mr-2" />
                <a href="tel:+543491000000" className="text-gray-400 hover:underline hover:text-white">
                  +54 (3491) 00-0000
                </a>
              </li>
              <li className="flex items-center">
                <Mail size={16} className="mr-2" />
                <a href="mailto:info@TerraNova.com" className="text-gray-400 hover:underline hover:text-white">
                  info@TerraNova.com
                </a>
              </li>
            </ul>
          </div>

          {/* 4. Redes Sociales */}
          <div>
            <h3 className="text-md font-semibold text-white uppercase mb-4">Seguinos</h3>
            <div className="flex space-x-4">
              <Link href="https://facebook.com" target="_blank" rel="noopener noreferrer" 
                    className="text-gray-400 hover:text-white transition-colors">
                <Facebook size={24} />
                <span className="sr-only">Facebook</span>
              </Link>
              <Link href="https://instagram.com" target="_blank" rel="noopener noreferrer" 
                    className="text-gray-400 hover:text-white transition-colors">
                <Instagram size={24} />
                <span className="sr-only">Instagram</span>
              </Link>
            </div>
          </div>

        </div>

        <hr className="my-12 border-gray-700" />

        {/* Sección Inferior - Copyright y Créditos */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-sm text-gray-400">
          <span className="text-center sm:text-left mb-2 sm:mb-0">
            © {new Date().getFullYear()}{" "}
            <Link href="/" className="hover:underline hover:text-white">
              TerraNova
            </Link>
            . Todos los derechos reservados.
          </span>
          <span className="text-center sm:text-right">
            Diseño y Desarrollo por{" "}
            <Link
              href="https://www.ignacioweppler.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-white hover:underline"
            >
              Ignacio Weppler
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
};