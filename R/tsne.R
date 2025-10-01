
## Input Vars
# perplex: numeric. Perplexity parameter (should not be bigger than
# 3 * perplexity < nrow(X)-1). This value effectively controls how many nearest
# neighbours are taken into account when constructing the embedding in the
# low-dimensional space (default: 30)
# maxIter: integer. Number of iterations (default: 1000)
##

run_tsne <- function(object,perplex=30,maxIter=1000){
    if(requireNamespace("Rtsne",quietly=TRUE)){
        data <- object$data
        if(3 * perplex > nrow(data)-1){
            perplex <- (nrow(data)-1)/3
        }
        tSNEcomponents <- Rtsne::Rtsne(data, dims=2, perplexity=perplex,
            verbose=FALSE, check_duplicates=FALSE, max_iter=maxIter)
        tsne <- tSNEcomponents$Y
        colnames(tsne) <- c("tSNE1","tSNE2")
        object <- addreduction(object,tsne,"tsne")
    }else{
        warning("Install 'Rtsne' to get tsne dimensionality reduction.")
    }
    return(object)
}
