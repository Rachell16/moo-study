export function CowMark({ className = "" }: { className?: string }) {
  return (
    <div className={`cow-mark ${className}`} aria-hidden="true">
      <span className="cow-ear cow-ear-left" />
      <span className="cow-ear cow-ear-right" />
      <span className="cow-spot cow-spot-one" />
      <span className="cow-spot cow-spot-two" />
      <span className="cow-eye cow-eye-left" />
      <span className="cow-eye cow-eye-right" />
      <span className="cow-muzzle"><i /><i /></span>
    </div>
  );
}