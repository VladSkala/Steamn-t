function PageContainer({ children }) {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 sm:px-6 lg:px-8">
      {children}
    </div>
  )
}

export default PageContainer