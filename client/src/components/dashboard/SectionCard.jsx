import { memo } from "react";

const SectionCard = ({ title, badge, className = "", children, headerClassName = "" }) => {
  return (
    <section className={`section-card-v2 ${className}`.trim()}>
      {(title || badge) ? (
        <div className={`section-card-v2__head ${headerClassName}`.trim()}>
          {title ? <h3>{title}</h3> : null}
          {badge ? <span className="section-card-v2__badge">{badge}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
};

export default memo(SectionCard);
