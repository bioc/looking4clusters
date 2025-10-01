# NMF: Nonnegative Matrix Factorization

run_nmf <- function(object){
    if(requireNamespace("NMF",quietly=TRUE)){
        data <- object$data
        if(!sum(colSums(data)==0)){
            if(!sum(rowSums(data)==0)){
                if(!sum(data<0)){
                    NMFcomponents <- NMF::nmf(data, rank=2, method="brunet")
                    nmf <- NMF::basis(NMFcomponents)
                    colnames(nmf) <- c("NMF1","NMF2")
                    object <- addreduction(object,nmf,"nmf")
                }else{
                    warning(
"Your data contains some negative entries, this is not supported for nmf."
                    )
                }
            }else{
                warning(
"Your data has rows that are all zeros, this is not supported for nmf."
                )
            }
        }else{
            warning(
"Your data has columns that are all zeros, this is not supported for nmf."
            )
        }
    }else{
        warning("Install 'NMF' to get nmf dimensionality reduction.")
    }
    return(object)
}
