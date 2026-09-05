import logoSrc from '../../assets/favicon.svg';

export const Logo = ({ className = "w-10 h-10" }) => {
  return (
    <img src={logoSrc} className={className} alt="Logo" />
  );
};
